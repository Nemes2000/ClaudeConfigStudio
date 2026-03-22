import { ipcMain } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  McpValidateCompatibilityRequest,
  McpInstallRequest,
  McpUninstallRequest,
  McpToggleRequest,
  McpSetAuthKeyRequest,
  McpListInstalledRequest,
} from '../../shared/ipc-channels'
import { validatePath } from '../infrastructure/fs/path-validator'
import {
  fetchMarketplace,
  validateCompatibility,
  installMcp,
  toggleMcp,
  uninstallMcp,
  setMcpAuthKey,
} from '../application/commands/mcp-use-cases'
import type { AppServices } from './app-services'

export function registerMcpHandlers(services: AppServices): void {
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_MARKETPLACE, async () => {
    try {
      const modules = await fetchMarketplace({ marketplaceClient: services.marketplaceClient })
      return { data: modules }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'list-marketplace', err })
      return { error: { code: 'MARKETPLACE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_VALIDATE_COMPATIBILITY, async (_event, req: McpValidateCompatibilityRequest) => {
    try {
      const result = await validateCompatibility({ mcpModule: req.mcpModule as Parameters<typeof validateCompatibility>[0]['mcpModule'], compatibilityChecker: services.compatibilityChecker })
      return { data: result }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'validate-compat', err })
      return { error: { code: 'COMPAT_CHECK_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_INSTALL, async (_event, req: McpInstallRequest) => {
    try {
      const installation = await installMcp({
        claudePath: validatePath(req.mcpModule.name, services.baseDir),
        mcpModule: req.mcpModule as Parameters<typeof installMcp>[0]['mcpModule'],
        configValues: req.configValues,
        ...(req.authKey !== undefined ? { authKey: req.authKey } : {}),
        installationRepo: services.mcpInstallationRepo,
        snapshotRepo: services.snapshotRepo,
        keychainService: services.keychainService,
        baseDir: services.baseDir,
      })
      return { data: installation }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'install', err })
      return { error: { code: 'MCP_INSTALL_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_TOGGLE, async (_event, req: McpToggleRequest) => {
    try {
      validatePath(req.claudePath, services.baseDir)
      const result = await toggleMcp({
        claudePath: req.claudePath,
        name: req.name,
        enabled: req.enabled,
        installationRepo: services.mcpInstallationRepo,
        snapshotRepo: services.snapshotRepo,
        baseDir: services.baseDir,
      })
      return { data: result }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'toggle', err })
      return { error: { code: 'MCP_TOGGLE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_UNINSTALL, async (_event, req: McpUninstallRequest) => {
    try {
      validatePath(req.claudePath, services.baseDir)
      await uninstallMcp({
        claudePath: req.claudePath,
        name: req.name,
        installationRepo: services.mcpInstallationRepo,
        snapshotRepo: services.snapshotRepo,
        keychainService: services.keychainService,
        baseDir: services.baseDir,
      })
      return { data: null }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'uninstall', err })
      return { error: { code: 'MCP_UNINSTALL_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_SET_AUTH_KEY, async (_event, req: McpSetAuthKeyRequest) => {
    try {
      const result = await setMcpAuthKey({
        name: req.name,
        authKey: req.authKey,
        claudePath: services.baseDir,
        installationRepo: services.mcpInstallationRepo,
        keychainService: services.keychainService,
      })
      return { data: result }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'set-auth-key', err })
      return { error: { code: 'MCP_AUTH_KEY_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_LIST_INSTALLED, async (_event, req: McpListInstalledRequest) => {
    try {
      validatePath(req.claudePath, services.baseDir)
      const installations = await services.mcpInstallationRepo.findAll(req.claudePath)
      return { data: installations }
    } catch (err) {
      log.error({ component: 'mcp-handlers', op: 'list-installed', err })
      return { error: { code: 'MCP_LIST_FAILED', message: String(err) } }
    }
  })
}
