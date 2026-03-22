import type { McpModule, McpInstallation, CompatibilityResult } from '../../domain/models/mcp'
import type { IMcpInstallationRepository } from '../services/i-mcp-installation-repository'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { snapshotFile } from './snapshot-file-use-case'
import { McpConfigValidationError } from '../../domain/exceptions'

export interface IMarketplaceClient {
  fetchModules(): Promise<McpModule[]>
  getCache(): McpModule[] | null
  setCache(modules: McpModule[]): void
}

export interface ICompatibilityChecker {
  check(mcpModule: McpModule): Promise<CompatibilityResult>
}

export interface IKeychainService {
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<void>
  getPassword(service: string, account: string): Promise<string | null>
}

const MCP_KEYCHAIN_SERVICE = 'claude-project-manager/mcp'

// ── Fetch Marketplace ──────────────────────────────────────────────────────────

export interface FetchMarketplaceParams {
  marketplaceClient: IMarketplaceClient
}

export async function fetchMarketplace(
  params: FetchMarketplaceParams,
): Promise<McpModule[]> {
  const { marketplaceClient } = params
  const cached = marketplaceClient.getCache()
  if (cached) return cached
  const modules = await marketplaceClient.fetchModules()
  marketplaceClient.setCache(modules)
  return modules
}

// ── Validate Compatibility ────────────────────────────────────────────────────

export interface ValidateCompatibilityParams {
  mcpModule: McpModule
  compatibilityChecker: ICompatibilityChecker
}

export async function validateCompatibility(
  params: ValidateCompatibilityParams,
): Promise<CompatibilityResult> {
  return params.compatibilityChecker.check(params.mcpModule)
}

// ── Install MCP ────────────────────────────────────────────────────────────────

export interface InstallMcpParams {
  claudePath: string
  mcpModule: McpModule
  configValues: Record<string, unknown>
  authKey?: string
  installationRepo: IMcpInstallationRepository
  snapshotRepo: ISnapshotRepository
  keychainService: IKeychainService
  baseDir: string
}

export async function installMcp(
  params: InstallMcpParams,
): Promise<McpInstallation> {
  const {
    claudePath,
    mcpModule,
    configValues,
    authKey,
    installationRepo,
    snapshotRepo,
    keychainService,
    baseDir,
  } = params

  // Validate config
  if (!mcpModule.validateConfig(configValues)) {
    throw new McpConfigValidationError([
      { field: 'config', message: 'Config does not satisfy module schema' },
    ])
  }

  const configFilePath = `${claudePath}/mcp/${mcpModule.name}.json`

  // Snapshot existing config if any
  await snapshotFile({ filePath: configFilePath, snapshotRepo, baseDir })

  const installation: McpInstallation = {
    moduleName: mcpModule.name,
    configFilePath,
    isEnabled: true,
    hasAuthKey: authKey !== undefined && authKey.length > 0,
    config: configValues,
  }

  // Write config (no auth key in config)
  await installationRepo.save(installation)

  // Store auth key in keychain only
  if (authKey && authKey.length > 0) {
    await keychainService.setPassword(MCP_KEYCHAIN_SERVICE, mcpModule.name, authKey)
  }

  return installation
}

// ── Toggle MCP ────────────────────────────────────────────────────────────────

export interface ToggleMcpParams {
  claudePath: string
  name: string
  enabled: boolean
  installationRepo: IMcpInstallationRepository
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function toggleMcp(params: ToggleMcpParams): Promise<McpInstallation> {
  const { claudePath, name, enabled, installationRepo, snapshotRepo, baseDir } = params
  const existing = await installationRepo.findByName(name, claudePath)
  if (!existing) throw new Error(`MCP installation "${name}" not found`)

  await snapshotFile({ filePath: existing.configFilePath, snapshotRepo, baseDir })
  const updated: McpInstallation = { ...existing, isEnabled: enabled }
  await installationRepo.save(updated)
  return updated
}

// ── Uninstall MCP ──────────────────────────────────────────────────────────────

export interface UninstallMcpParams {
  claudePath: string
  name: string
  installationRepo: IMcpInstallationRepository
  snapshotRepo: ISnapshotRepository
  keychainService: IKeychainService
  baseDir: string
}

export async function uninstallMcp(params: UninstallMcpParams): Promise<void> {
  const { claudePath, name, installationRepo, snapshotRepo, keychainService, baseDir } =
    params
  const existing = await installationRepo.findByName(name, claudePath)
  if (!existing) return

  await snapshotFile({ filePath: existing.configFilePath, snapshotRepo, baseDir })
  await installationRepo.delete(name, claudePath)

  try {
    await keychainService.deletePassword(MCP_KEYCHAIN_SERVICE, name)
  } catch {
    // Key may not exist — not an error
  }
}

// ── Set Auth Key ───────────────────────────────────────────────────────────────

export interface SetMcpAuthKeyParams {
  name: string
  authKey: string
  claudePath: string
  installationRepo: IMcpInstallationRepository
  keychainService: IKeychainService
}

export async function setMcpAuthKey(
  params: SetMcpAuthKeyParams,
): Promise<McpInstallation> {
  const { name, authKey, claudePath, installationRepo, keychainService } = params
  if (!authKey || authKey.length === 0) {
    throw new Error('authKey must be a non-empty string')
  }
  const existing = await installationRepo.findByName(name, claudePath)
  if (!existing) throw new Error(`MCP installation "${name}" not found`)

  await keychainService.setPassword(MCP_KEYCHAIN_SERVICE, name, authKey)
  const updated: McpInstallation = { ...existing, hasAuthKey: true }
  await installationRepo.save(updated)
  return updated
}
