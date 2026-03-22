import { ClaudeCompatibilityChecker } from '@main/infrastructure/http/compatibility-checker'
import type { McpModule } from '@main/domain/models/mcp'

jest.mock('child_process')

import { execFile } from 'child_process'

const execFileAsync = jest.mocked(require('util').promisify(execFile))

describe('ClaudeCompatibilityChecker', () => {
  let checker: ClaudeCompatibilityChecker

  beforeEach(() => {
    jest.clearAllMocks()
    checker = new ClaudeCompatibilityChecker()
  })

  const createMcpModule = (minVersion = '1.0.0'): McpModule => ({
    name: 'test-mcp',
    displayName: 'Test MCP',
    description: 'A test MCP',
    version: '1.0.0',
    author: 'Test',
    repositoryUrl: 'https://example.com',
    configSchema: { type: 'object', properties: {} },
    minClaudeVersion: minVersion,
    authRequired: false,
    authKeyLabel: 'API Key',
    validateConfig: jest.fn().mockReturnValue([]),
  })

  describe('check', () => {
    it('should return compatible=true when Claude version matches or exceeds minimum', async () => {
      // Mock execFile to return version output
      const mockExecFile = jest.fn()
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: 'Claude version 1.5.0' })
          }
        },
      )

      const module = createMcpModule('1.0.0')
      const result = await checker.check(module)

      expect(result.isCompatible).toBe(true)
      expect(result.detectedClaudeVersion).toBe('1.5.0')
      expect(result.reason).toBe('Compatible')
    })

    it('should return compatible=false when Claude version is below minimum', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: 'Claude version 0.9.0' })
          }
        },
      )

      const module = createMcpModule('1.0.0')
      const result = await checker.check(module)

      expect(result.isCompatible).toBe(false)
      expect(result.reason).toContain('Requires Claude 1.0.0+')
      expect(result.reason).toContain('0.9.0')
    })

    it('should return not-found when Claude CLI is not installed', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(new Error('Command not found'))
          }
        },
      )

      const module = createMcpModule('1.0.0')
      const result = await checker.check(module)

      expect(result.isCompatible).toBe(false)
      expect(result.detectedClaudeVersion).toBe('not-found')
      expect(result.reason).toContain('Claude CLI not found')
    })

    it('should handle version strings with varying formats', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: 'Claude CLI 2.3.4-beta' })
          }
        },
      )

      const module = createMcpModule('2.0.0')
      const result = await checker.check(module)

      expect(result.detectedClaudeVersion).toBe('2.3.4')
      expect(result.isCompatible).toBe(true)
    })

    it('should compare versions correctly when major/minor/patch differ', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: 'version: 1.2.3' })
          }
        },
      )

      const module = createMcpModule('1.2.3')
      const result = await checker.check(module)

      expect(result.isCompatible).toBe(true)
    })

    it('should handle patch version differences', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: 'Claude 1.2.5' })
          }
        },
      )

      const module = createMcpModule('1.2.3')
      const result = await checker.check(module)

      expect(result.isCompatible).toBe(true)
    })

    it('should return unknown when version parsing fails', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: 'Some random output' })
          }
        },
      )

      const module = createMcpModule('1.0.0')
      const result = await checker.check(module)

      expect(result.detectedClaudeVersion).toBe('unknown')
      expect(result.isCompatible).toBe(false)
    })

    it('should include module minVersion in result', async () => {
      jest.mocked(require('child_process').execFile).mockImplementation(
        (cmd: string, args: string[], options: any, callback: any) => {
          if (cmd === 'claude' && args.includes('--version')) {
            callback(null, { stdout: '2.0.0' })
          }
        },
      )

      const module = createMcpModule('1.5.0')
      const result = await checker.check(module)

      expect(result.requiredMinVersion).toBe('1.5.0')
    })
  })
})
