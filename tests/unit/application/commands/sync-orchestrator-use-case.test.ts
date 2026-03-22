import {
  syncOrchestrators,
  type SyncOrchestratorParams,
  type IStreamingAnthropicClient,
} from '@main/application/commands/sync-orchestrator-use-case'
import type { ICircuitBreaker, IRateLimiter } from '@main/application/commands/generate-suggestions-use-case'
import type { SkillNode } from '@main/domain/models/skill-node'
import { CircuitOpenError } from '@main/domain/exceptions'

jest.mock('fs/promises')

import * as fs from 'fs/promises'

describe('syncOrchestrators', () => {
  let mockCircuitBreaker: jest.Mocked<ICircuitBreaker>
  let mockRateLimiter: jest.Mocked<IRateLimiter>
  let mockStreamingClient: jest.Mocked<IStreamingAnthropicClient>
  let modifiedSkill: SkillNode
  let orchestrators: SkillNode[]

  beforeEach(() => {
    jest.clearAllMocks()

    modifiedSkill = {
      slug: 'test-skill',
      name: 'Test Skill',
      description: 'Test',
      version: '1.0.0',
      filePath: '/path/test-skill/SKILL.md',
      isEnabled: true,
      dependencies: [],
      mcpServers: [],
      diagrams: [],
      triggers: [],
      isMissingFrontmatter: false,
      hasPurposeSection: true,
      hasInstructionsSection: true,
    }

    orchestrators = [
      {
        ...modifiedSkill,
        slug: 'orchestrator-1',
        filePath: '/path/orchestrator-1/SKILL.md',
      },
      {
        ...modifiedSkill,
        slug: 'orchestrator-2',
        filePath: '/path/orchestrator-2/SKILL.md',
      },
    ]

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

    mockStreamingClient = {
      streamOrchestratorSync: jest
        .fn()
        .mockResolvedValue({ content: 'updated content', isPartial: false }),
    } as any
  })

  it('should throw CircuitOpenError when circuit breaker is open', async () => {
    Object.defineProperty(mockCircuitBreaker, 'state', { get: () => 'OPEN', configurable: true })

    await expect(
      syncOrchestrators({
        modifiedSkill,
        orchestrators,
        modifiedSkillContent: 'test content',
        circuitBreaker: mockCircuitBreaker,
        rateLimiter: mockRateLimiter,
        streamingClient: mockStreamingClient,
        onChunk: jest.fn(),
        onStarted: jest.fn(),
        onCompleted: jest.fn(),
      }),
    ).rejects.toThrow(CircuitOpenError)
  })

  it('should call onStarted with orchestrator paths', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old content')

    const onStarted = jest.fn()
    await syncOrchestrators({
      modifiedSkill,
      orchestrators,
      modifiedSkillContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted,
      onCompleted: jest.fn(),
    })

    expect(onStarted).toHaveBeenCalledWith([
      '/path/orchestrator-1/SKILL.md',
      '/path/orchestrator-2/SKILL.md',
    ])
  })

  it('should call onCompleted with orchestrator paths', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old content')

    const onCompleted = jest.fn()
    await syncOrchestrators({
      modifiedSkill,
      orchestrators,
      modifiedSkillContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted,
    })

    expect(onCompleted).toHaveBeenCalledWith([
      '/path/orchestrator-1/SKILL.md',
      '/path/orchestrator-2/SKILL.md',
    ])
  })

  it('should process each orchestrator sequentially', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old content')

    let acquireCount = 0
    mockRateLimiter.acquire.mockImplementation(async () => {
      acquireCount++
    })

    await syncOrchestrators({
      modifiedSkill,
      orchestrators,
      modifiedSkillContent: 'test content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(mockRateLimiter.acquire).toHaveBeenCalledTimes(2)
    expect(mockRateLimiter.release).toHaveBeenCalledTimes(2)
  })

  it('should read orchestrator content before streaming', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('orchestrator old content')

    await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill content',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(fs.readFile).toHaveBeenCalledWith('/path/orchestrator-1/SKILL.md', 'utf-8')
  })

  it('should call streaming client with correct content', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('orchestrator old')

    await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill new',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(mockStreamingClient.streamOrchestratorSync).toHaveBeenCalledWith(
      'skill new',
      'orchestrator old',
      expect.any(Function),
      120_000,
    )
  })

  it('should call onChunk for streaming chunks', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old')

    const onChunk = jest.fn()
    let chunkCallback: ((chunk: string) => void) | null = null

    mockStreamingClient.streamOrchestratorSync.mockImplementation(
      async (skill, orch, onChunkCb, timeout) => {
        chunkCallback = onChunkCb
        return { content: 'new', isPartial: false }
      },
    )

    await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk,
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    if (chunkCallback !== null) {
      ;(chunkCallback as (c: string) => void)('chunk1')
      ;(chunkCallback as (c: string) => void)('chunk2')
    }

    expect(onChunk).toHaveBeenCalledWith('/path/orchestrator-1/SKILL.md', 'chunk1')
    expect(onChunk).toHaveBeenCalledWith('/path/orchestrator-1/SKILL.md', 'chunk2')
  })

  it('should record success when sync completes without partial content', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old')
    mockStreamingClient.streamOrchestratorSync.mockResolvedValue({
      content: 'new',
      isPartial: false,
    })

    await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled()
  })

  it('should record failure when sync returns partial content', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old')
    mockStreamingClient.streamOrchestratorSync.mockResolvedValue({
      content: 'partial new',
      isPartial: true,
    })

    await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled()
  })

  it('should handle streaming client error gracefully', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old')
    mockStreamingClient.streamOrchestratorSync.mockRejectedValue(
      new Error('Streaming failed'),
    )

    const results = await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(results).toHaveLength(1)
    expect(results[0]!.isPartial).toBe(true)
    expect(results[0]!.newContent).toBe('old') // Falls back to old content
    expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled()
  })

  it('should release rate limiter even on error', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('old')
    mockStreamingClient.streamOrchestratorSync.mockRejectedValue(
      new Error('Streaming failed'),
    )

    await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(mockRateLimiter.release).toHaveBeenCalled()
  })

  it('should return update results with old and new content', async () => {
    jest.mocked(fs.readFile).mockResolvedValue('orchestrator old')
    mockStreamingClient.streamOrchestratorSync.mockResolvedValue({
      content: 'orchestrator new',
      isPartial: false,
    })

    const results = await syncOrchestrators({
      modifiedSkill,
      orchestrators: [orchestrators[0]!],
      modifiedSkillContent: 'skill',
      circuitBreaker: mockCircuitBreaker,
      rateLimiter: mockRateLimiter,
      streamingClient: mockStreamingClient,
      onChunk: jest.fn(),
      onStarted: jest.fn(),
      onCompleted: jest.fn(),
    })

    expect(results).toHaveLength(1)
    expect(results[0]!.orchestratorPath).toBe('/path/orchestrator-1/SKILL.md')
    expect(results[0]!.oldContent).toBe('orchestrator old')
    expect(results[0]!.newContent).toBe('orchestrator new')
    expect(results[0]!.isPartial).toBe(false)
  })
})
