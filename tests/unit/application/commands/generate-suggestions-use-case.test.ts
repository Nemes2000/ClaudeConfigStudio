import {
  generateSuggestions,
  type GenerateSuggestionsParams,
  type ISuggestionsAnthropicClient,
  type ICircuitBreaker,
  type IRateLimiter,
} from '@main/application/commands/generate-suggestions-use-case'
import type { SkillNode } from '@main/domain/models/skill-node'
import { CircuitOpenError } from '@main/domain/exceptions'

describe('generateSuggestions', () => {
  let mockCircuitBreaker: jest.Mocked<ICircuitBreaker>
  let mockRateLimiter: jest.Mocked<IRateLimiter>
  let mockAnthropicClient: jest.Mocked<ISuggestionsAnthropicClient>
  let skillNode: SkillNode

  beforeEach(() => {
    jest.clearAllMocks()

    skillNode = {
      slug: 'test-skill',
      name: 'Test Skill',
      description: 'A test skill',
      version: '1.0.0',
      filePath: '/path/skill.md',
      isEnabled: true,
      dependencies: ['dep1'],
      mcpServers: [],
      diagrams: [],
      triggers: [],
      isMissingFrontmatter: false,
      hasPurposeSection: true,
      hasInstructionsSection: true,
    }

    mockCircuitBreaker = {
      state: 'CLOSED',
      check: jest.fn(),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    }

    mockRateLimiter = {
      acquire: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    }

    mockAnthropicClient = {
      generateSuggestions: jest
        .fn()
        .mockResolvedValue(JSON.stringify([{ type: 'simplify', title: 'Simplify logic' }])),
    } as any
  })

  it('should throw CircuitOpenError when circuit breaker is open', async () => {
    const openCircuitBreaker: typeof mockCircuitBreaker = {
      ...mockCircuitBreaker,
      state: 'OPEN',
    }

    await expect(
      generateSuggestions({
        skillNode,
        fileContent: 'test content',
        circuitBreaker: openCircuitBreaker,
        rateLimiter: mockRateLimiter,
        anthropicClient: mockAnthropicClient,
      }),
    ).rejects.toThrow(CircuitOpenError)
  })

  it('should acquire rate limiter before processing', async () => {
    await generateSuggestions({
      skillNode,
      fileContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    expect(mockRateLimiter.acquire).toHaveBeenCalled()
  })

  it('should release rate limiter after processing', async () => {
    await generateSuggestions({
      skillNode,
      fileContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    expect(mockRateLimiter.release).toHaveBeenCalled()
  })

  it('should release rate limiter even if processing fails', async () => {
    mockAnthropicClient.generateSuggestions.mockRejectedValue(new Error('API error'))

    try {
      await generateSuggestions({
        skillNode,
        fileContent: 'test content',
        circuitBreaker: mockCircuitBreaker,
        rateLimiter: mockRateLimiter,
        anthropicClient: mockAnthropicClient,
      })
    } catch {
      // Expected
    }

    expect(mockRateLimiter.release).toHaveBeenCalled()
  })

  it('should return parsed suggestions on success', async () => {
    const suggestions = [
      { type: 'simplify', title: 'Simplify', description: 'Simplify logic', affectedSlug: 'test', severity: 'info', affectedSection: '' },
    ]
    mockAnthropicClient.generateSuggestions.mockResolvedValue(JSON.stringify(suggestions))

    const result = await generateSuggestions({
      skillNode,
      fileContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    expect(result).toEqual(suggestions)
  })

  it('should record success when suggestions are valid', async () => {
    const suggestions = [{ type: 'simplify', title: 'Simplify', description: 'Test', affectedSlug: 'test', severity: 'info', affectedSection: '' }]
    mockAnthropicClient.generateSuggestions.mockResolvedValue(JSON.stringify(suggestions))

    await generateSuggestions({
      skillNode,
      fileContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled()
  })

  it('should return empty array and record failure on invalid JSON', async () => {
    mockAnthropicClient.generateSuggestions.mockResolvedValue('invalid json')

    const result = await generateSuggestions({
      skillNode,
      fileContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    expect(result).toEqual([])
    expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled()
  })

  it('should truncate large content', async () => {
    const largeContent = 'x'.repeat(100000)

    await generateSuggestions({
      skillNode,
      fileContent: largeContent,
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    const callArgs = mockAnthropicClient.generateSuggestions.mock.calls[0]
    const userPrompt = callArgs![1]
    expect(userPrompt).toContain('[Content truncated]')
  })

  it('should check circuit breaker before acquiring rate limiter', async () => {
    mockCircuitBreaker.check.mockImplementation(() => {
      throw new Error('Circuit check failed')
    })

    await expect(
      generateSuggestions({
        skillNode,
        fileContent: 'test content',
        circuitBreaker: mockCircuitBreaker,
        rateLimiter: mockRateLimiter,
        anthropicClient: mockAnthropicClient,
      }),
    ).rejects.toThrow('Circuit check failed')

    expect(mockRateLimiter.release).toHaveBeenCalled() // Released in finally
  })

  it('should include skill information in prompt', async () => {
    await generateSuggestions({
      skillNode: {
        ...skillNode,
        slug: 'my-special-skill',
        dependencies: ['dep1', 'dep2'],
      },
      fileContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      anthropicClient: mockAnthropicClient,
    })

    const userPrompt = mockAnthropicClient.generateSuggestions.mock.calls[0]![1]
    expect(userPrompt).toContain('my-special-skill')
    expect(userPrompt).toContain('dep1')
  })
})
