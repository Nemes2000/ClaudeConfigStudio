import { McpMarketplaceClient } from '@main/infrastructure/http/mcp-marketplace-client'
import type { McpModule } from '@main/domain/models/mcp'
import * as electronLog from 'electron-log'

jest.mock('electron-log')

describe('McpMarketplaceClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const createMockModule = (name: string): McpModule => ({
    name,
    displayName: `${name} Display`,
    description: `Description for ${name}`,
    version: '1.0.0',
    author: 'Test',
    repositoryUrl: 'https://example.com',
    configSchema: { type: 'object', properties: {} },
    minClaudeVersion: name === 'module-2' ? '2.0.0' : '1.0.0',
    authRequired: false,
    authKeyLabel: 'API Key',
    validateConfig: jest.fn().mockReturnValue([]),
  })

  const mockModules: McpModule[] = [createMockModule('module-1'), createMockModule('module-2')]

  describe('fetchModules', () => {
    it('should fetch modules from registry URL', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockModules),
      }
      global.fetch = jest.fn().mockResolvedValue(mockResponse) as any

      const client = new McpMarketplaceClient('https://example.com/registry')
      const result = await client.fetchModules()

      expect(result).toEqual(mockModules)
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/registry',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        }),
      )
    })

    it('should return empty array on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as any

      const client = new McpMarketplaceClient('https://example.com/registry')
      const result = await client.fetchModules()

      expect(result).toEqual([])
      expect(electronLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'mcp-marketplace-client',
        }),
      )
    })

    it('should return empty array when response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      }
      global.fetch = jest.fn().mockResolvedValue(mockResponse) as any

      const client = new McpMarketplaceClient('https://example.com/registry')
      const result = await client.fetchModules()

      expect(result).toEqual([])
      expect(electronLog.error).toHaveBeenCalled()
    })

    it('should return empty array when JSON parsing fails', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      }
      global.fetch = jest.fn().mockResolvedValue(mockResponse) as any

      const client = new McpMarketplaceClient('https://example.com/registry')
      const result = await client.fetchModules()

      expect(result).toEqual([])
      expect(electronLog.error).toHaveBeenCalled()
    })

    it('should handle fetch errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as any
      const client = new McpMarketplaceClient('https://example.com/registry')
      const result = await client.fetchModules()
      expect(result).toEqual([])
    })

    it('should clear timeout after request completes', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockModules),
      }
      global.fetch = jest.fn().mockResolvedValue(mockResponse) as any

      const client = new McpMarketplaceClient('https://example.com/registry')
      await client.fetchModules()

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('cache', () => {
    it('should return null when cache is empty', () => {
      const client = new McpMarketplaceClient('https://example.com/registry')
      const cached = client.getCache()

      expect(cached).toBeNull()
    })

    it('should return cached modules when cache is valid', () => {
      const client = new McpMarketplaceClient('https://example.com/registry')
      client.setCache(mockModules)

      const cached = client.getCache()

      expect(cached).toEqual(mockModules)
    })

    it('should return null when cache has expired (> 1 hour)', () => {
      const client = new McpMarketplaceClient('https://example.com/registry')
      client.setCache(mockModules)

      // Advance time by 61 minutes
      jest.advanceTimersByTime(61 * 60 * 1000)

      const cached = client.getCache()

      expect(cached).toBeNull()
    })

    it('should return cached modules when time is within TTL', () => {
      const client = new McpMarketplaceClient('https://example.com/registry')
      client.setCache(mockModules)

      // Advance time by 30 minutes
      jest.advanceTimersByTime(30 * 60 * 1000)

      const cached = client.getCache()

      expect(cached).toEqual(mockModules)
    })

    it('should update cache time when setting cache', () => {
      const client = new McpMarketplaceClient('https://example.com/registry')

      const before = Date.now()
      client.setCache(mockModules)
      const after = Date.now()

      const cached = client.getCache()
      expect(cached).not.toBeNull()
    })

    it('should replace old cache with new cache', () => {
      const client = new McpMarketplaceClient('https://example.com/registry')
      const oldModules = [mockModules[0]!]
      const newModules = [mockModules[1]!]

      client.setCache(oldModules)
      expect(client.getCache()).toEqual(oldModules)

      client.setCache(newModules)
      expect(client.getCache()).toEqual(newModules)
    })
  })
})
