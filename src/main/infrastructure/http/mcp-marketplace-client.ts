import type { McpModule } from '../../domain/models/mcp'
import type { IMarketplaceClient } from '../../application/commands/mcp-use-cases'
import log from 'electron-log'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const REQUEST_TIMEOUT_MS = 15_000

export class McpMarketplaceClient implements IMarketplaceClient {
  private _cache: McpModule[] | null = null
  private _cacheTime = 0
  private readonly _registryUrl: string

  constructor(registryUrl: string) {
    this._registryUrl = registryUrl
  }

  getCache(): McpModule[] | null {
    if (!this._cache) return null
    if (Date.now() - this._cacheTime > CACHE_TTL_MS) return null
    return this._cache
  }

  setCache(modules: McpModule[]): void {
    this._cache = modules
    this._cacheTime = Date.now()
  }

  async fetchModules(): Promise<McpModule[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const resp = await fetch(this._registryUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!resp.ok) throw new Error(`Registry returned ${resp.status}`)
      const data = (await resp.json()) as McpModule[]
      return data
    } catch (err) {
      log.error({ component: 'mcp-marketplace-client', err })
      return []
    } finally {
      clearTimeout(timeout)
    }
  }
}
