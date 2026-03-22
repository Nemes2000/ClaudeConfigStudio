/**
 * Composition root — all services wired and passed to IPC handlers.
 * No DI scattered across modules; single composition point.
 */
import { homedir } from 'os'
import { SnapshotRepository } from '../infrastructure/repositories/snapshot-repository'
import { SkillNodeRepository } from '../infrastructure/repositories/skill-node-repository'
import { McpInstallationRepository } from '../infrastructure/repositories/mcp-installation-repository'
import { KeytarService } from '../infrastructure/keychain/keytar-service'
import { AnthropicApiClient, CircuitBreaker, RateLimiter } from '../infrastructure/http/anthropic-client'
import { McpMarketplaceClient } from '../infrastructure/http/mcp-marketplace-client'
import { ClaudeCompatibilityChecker } from '../infrastructure/http/compatibility-checker'
import { startWatcher, type FileWatcher } from '../infrastructure/watcher/chokidar-watcher'
import type { ISnapshotRepository } from '../application/services/i-snapshot-repository'
import type { ISkillNodeRepository } from '../application/services/i-skill-node-repository'
import type { IMcpInstallationRepository } from '../application/services/i-mcp-installation-repository'
import type { IKeychainService } from '../infrastructure/keychain/keytar-service'
import type { ICircuitBreaker, IRateLimiter, ISuggestionsAnthropicClient } from '../application/commands/generate-suggestions-use-case'
import type { IStreamingAnthropicClient } from '../application/commands/sync-orchestrator-use-case'
import type { IAnthropicClient } from '../application/commands/validate-api-key-use-case'
import type { IMarketplaceClient, ICompatibilityChecker } from '../application/commands/mcp-use-cases'
import type { ClaudeFolder } from '../domain/models/claude-folder'

const MCP_REGISTRY_URL = 'https://registry.mcp.anthropic.com/v1/modules'

export interface AppServices {
  baseDir: string
  snapshotRepo: ISnapshotRepository
  skillNodeRepo: ISkillNodeRepository
  mcpInstallationRepo: IMcpInstallationRepository
  keychainService: IKeychainService
  anthropicClient: IAnthropicClient & IStreamingAnthropicClient & ISuggestionsAnthropicClient
  circuitBreaker: ICircuitBreaker
  rateLimiter: IRateLimiter
  marketplaceClient: IMarketplaceClient
  compatibilityChecker: ICompatibilityChecker
  startWatcher: (path: string, onChange: (p: string) => void) => void
  listDiscoveredFolders: () => ClaudeFolder[]
}

export function createAppServices(): AppServices {
  const baseDir = homedir()
  const watchers: FileWatcher[] = []
  const discoveredFolders: ClaudeFolder[] = []

  const snapshotRepo = new SnapshotRepository()
  const skillNodeRepo = new SkillNodeRepository()
  const mcpInstallationRepo = new McpInstallationRepository()
  const keychainService = new KeytarService()
  const anthropicClient = new AnthropicApiClient()
  const circuitBreaker = new CircuitBreaker()
  const rateLimiter = new RateLimiter(3)
  const marketplaceClient = new McpMarketplaceClient(MCP_REGISTRY_URL)
  const compatibilityChecker = new ClaudeCompatibilityChecker()

  return {
    baseDir,
    snapshotRepo,
    skillNodeRepo,
    mcpInstallationRepo,
    keychainService,
    anthropicClient: anthropicClient as AppServices['anthropicClient'],
    circuitBreaker,
    rateLimiter,
    marketplaceClient,
    compatibilityChecker,
    startWatcher(watchPath, onChange) {
      const watcher = startWatcher(watchPath, onChange)
      watchers.push(watcher)
    },
    listDiscoveredFolders() {
      return discoveredFolders
    },
  }
}
