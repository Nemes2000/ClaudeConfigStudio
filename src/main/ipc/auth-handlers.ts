import { ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AuthValidateRequest } from '../../shared/ipc-channels'
import { validateApiKey } from '../application/commands/validate-api-key-use-case'
import type { AppServices } from './app-services'

export function registerAuthHandlers(
  win: BrowserWindow,
  services: AppServices,
): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_VALIDATE, async (_event, req: AuthValidateRequest) => {
    try {
      const result = await validateApiKey({
        keychainService: services.keychainService,
        anthropicClient: services.anthropicClient,
        ...(req.apiKey !== undefined ? { apiKey: req.apiKey } : {}),
      })

      win.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, {
        ...result.authState,
        lastValidatedAt: result.authState.lastValidatedAt?.toISOString() ?? null,
        reason: result.reason,
      })

      return {
        data: {
          ok: result.authState.isValid,
          authState: {
            ...result.authState,
            lastValidatedAt: result.authState.lastValidatedAt?.toISOString() ?? null,
          },
        },
      }
    } catch (err) {
      log.error({ component: 'auth-handlers', op: 'validate', err })
      return { error: { code: 'AUTH_ERROR', message: String(err) } }
    }
  })
}
