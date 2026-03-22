import { ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AuthValidateRequest } from '../../shared/ipc-channels'
import { validateApiKey } from '../application/commands/validate-api-key-use-case'
import { signInWithClaude } from '../application/commands/sign-in-with-claude-use-case'
import { signOut } from '../application/commands/sign-out-use-case'
import type { AppServices } from './app-services'

function serializeAuthState(authState: { isValid: boolean; keyPresent: boolean; lastValidatedAt: Date | null; authMethod: string | null }): { isValid: boolean; keyPresent: boolean; lastValidatedAt: string | null; authMethod: string | null } {
  return {
    ...authState,
    lastValidatedAt: authState.lastValidatedAt?.toISOString() ?? null,
  }
}

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

      const serialized = serializeAuthState(result.authState)
      win.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, {
        ...serialized,
        reason: result.reason,
      })

      return {
        data: {
          ok: result.authState.isValid,
          authState: serialized,
        },
      }
    } catch (err) {
      log.error({ component: 'auth-handlers', op: 'validate', err })
      return { error: { code: 'AUTH_ERROR', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_IN_WITH_CLAUDE, async () => {
    try {
      const result = await signInWithClaude({
        keychainService: services.keychainService,
      })

      const serialized = serializeAuthState(result.authState)
      win.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, {
        ...serialized,
        reason: 'sign-in-with-claude',
      })

      return {
        ok: result.authState.isValid,
        authState: serialized,
        reason: result.reason,
        message: result.message,
      }
    } catch (err) {
      log.error({ component: 'auth-handlers', op: 'sign-in-with-claude', err })
      return {
        ok: false,
        authState: {
          isValid: false,
          keyPresent: false,
          lastValidatedAt: null,
          authMethod: null,
        },
        reason: 'error',
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
    try {
      const result = await signOut({
        keychainService: services.keychainService,
      })

      const serialized = serializeAuthState(result.authState)
      win.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, {
        ...serialized,
        reason: 'sign-out',
      })

      return {
        ok: true,
        authState: serialized,
      }
    } catch (err) {
      log.error({ component: 'auth-handlers', op: 'sign-out', err })
      return {
        ok: false,
        authState: {
          isValid: false,
          keyPresent: false,
          lastValidatedAt: null,
          authMethod: null,
        },
      }
    }
  })
}
