import { ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { SuggestionRequestPayload } from '../../shared/ipc-channels'
import { generateSuggestions } from '../application/commands/generate-suggestions-use-case'
import type { AppServices } from './app-services'

export function registerSuggestionHandlers(
  win: BrowserWindow,
  services: AppServices,
): void {
  ipcMain.handle(IPC_CHANNELS.SUGGESTION_REQUEST, async (_event, req: SuggestionRequestPayload) => {
    try {
      const suggestions = await generateSuggestions({
        skillNode: req.skillNode as Parameters<typeof generateSuggestions>[0]['skillNode'],
        fileContent: req.fileContent,
        circuitBreaker: services.circuitBreaker,
        rateLimiter: services.rateLimiter,
        anthropicClient: services.anthropicClient,
      })

      win.webContents.send(IPC_CHANNELS.SUGGESTION_READY, suggestions)
      return { data: suggestions }
    } catch (err) {
      log.error({ component: 'suggestion-handlers', op: 'request', err })
      return { error: { code: 'SUGGESTION_FAILED', message: String(err) } }
    }
  })
}
