import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { createAppServices } from './ipc/app-services'
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerSkillHandlers } from './ipc/skill-handlers'
import { registerAuthHandlers } from './ipc/auth-handlers'
import { registerBackupHandlers } from './ipc/backup-handlers'
import { registerSuggestionHandlers } from './ipc/suggestion-handlers'
import { registerMcpHandlers } from './ipc/mcp-handlers'
import { validateApiKey } from './application/commands/validate-api-key-use-case'
import { IPC_CHANNELS } from '../shared/ipc-channels'

log.initialize()

let mainWindow: BrowserWindow | null = null
const services = createAppServices()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    titleBarStyle: 'hiddenInset',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the default browser — not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerAllHandlers(win: BrowserWindow): void {
  registerProjectHandlers(win, services)
  registerFileHandlers(services)
  registerSkillHandlers(services)
  registerAuthHandlers(win, services)
  registerBackupHandlers(win, services)
  registerSuggestionHandlers(win, services)
  registerMcpHandlers(services)
}

app.whenReady().then(async () => {
  createWindow()
  if (!mainWindow) return

  registerAllHandlers(mainWindow)

  // Run auth validation at startup
  try {
    const result = await validateApiKey({
      keychainService: services.keychainService,
      anthropicClient: services.anthropicClient,
    })

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, {
        ...result.authState,
        lastValidatedAt: result.authState.lastValidatedAt?.toISOString() ?? null,
        reason: result.reason,
      })
    })
  } catch (err) {
    log.error({ component: 'main', op: 'startup-auth', err })
  }

  log.info({ component: 'main', op: 'ready' })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
    if (mainWindow) registerAllHandlers(mainWindow)
  }
})
