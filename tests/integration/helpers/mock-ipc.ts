/**
 * Shared helpers for mocking Electron IPC in Playwright integration tests.
 *
 * Architecture:
 *  - `mockIpcInvoke`: installs a mock handler directly in the Electron MAIN
 *    PROCESS via `app.evaluate()`, replacing the real `ipcMain.handle()` for
 *    the given channel. This is the only reliable approach because
 *    `contextBridge.exposeInMainWorld` creates read-only properties in the
 *    renderer, so patching `window.electronApi.invoke` silently fails.
 *
 *  - `emitIpcPush`: sends a real push event from the main process via
 *    `BrowserWindow.getAllWindows()[0].webContents.send()`.
 *
 *  - `invokeIpc`: calls `window.electronApi.invoke` from the renderer.
 *    Works with or without mocks because with mocks the ipcMain handler
 *    returns the canned value.
 *
 *  - All mocks are cleaned up automatically in `afterEach` via `restoreAllMocks`.
 */

import { Page } from 'playwright'
import { _electron as electron, ElectronApplication } from 'playwright'
import * as path from 'path'

/** Reference to the current app for main-process operations. */
let _currentApp: ElectronApplication | null = null

/** Track which channels have been mocked so we can restore them. */
const _mockedChannels: string[] = []

// ─── App launch ──────────────────────────────────────────────────────────────

export interface LaunchOptions {
  env?: Record<string, string>
}

export async function launchApp(opts: LaunchOptions = {}): Promise<ElectronApplication> {
  // --no-sandbox is required when running as root or inside a container (CI).
  const extraArgs = process.env.CI ? ['--no-sandbox'] : []
  const app = await electron.launch({
    args: [...extraArgs, path.join(__dirname, '../../../dist/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_RUN_AS_NODE: '',
      ...opts.env,
    },
  })
  _currentApp = app
  _mockedChannels.length = 0
  return app
}

// ─── Wait for electronApi in renderer ────────────────────────────────────────

async function waitForApi(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { electronApi?: unknown }).electronApi !== 'undefined',
    { timeout: 10_000 },
  )
}

// ─── IPC invoke mocking (main-process level) ─────────────────────────────────

/**
 * Install a mock handler for `channel` in the Electron main process.
 * The real handler is removed and replaced with one that returns `response`.
 *
 * Call `restoreAllMocks()` in afterEach to clean up.
 */
export async function mockIpcInvoke(
  _page: Page,
  channel: string,
  response: unknown,
): Promise<void> {
  if (!_currentApp) throw new Error('mockIpcInvoke: no app — call launchApp() first')

  await _currentApp.evaluate(
    ({ ipcMain }, { ch, resp }: { ch: string; resp: unknown }) => {
      ipcMain.removeHandler(ch)
      ipcMain.handle(ch, () => resp)
    },
    { ch: channel, resp: response },
  )

  if (!_mockedChannels.includes(channel)) {
    _mockedChannels.push(channel)
  }
}

/**
 * Remove all mock handlers installed by this session (call in afterEach).
 * Note: the original handlers are NOT restored; the test app is closed anyway.
 */
export async function restoreAllMocks(): Promise<void> {
  if (!_currentApp) return
  const channels = [..._mockedChannels]
  _mockedChannels.length = 0
  if (channels.length === 0) return

  await _currentApp.evaluate(
    ({ ipcMain }, chs: string[]) => {
      for (const ch of chs) {
        ipcMain.removeHandler(ch)
      }
    },
    channels,
  )
}

// ─── IPC push event (main → renderer) ────────────────────────────────────────

/**
 * Send a push event from the Electron main process to all renderer windows.
 */
export async function emitIpcPush(
  _page: Page,
  channel: string,
  payload: unknown,
): Promise<void> {
  if (!_currentApp) throw new Error('emitIpcPush: no app — call launchApp() first')

  await _currentApp.evaluate(
    ({ BrowserWindow }, args: { ch: string; pl: unknown }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(args.ch, args.pl)
      }
    },
    { ch: channel, pl: payload },
  )
}

// ─── Direct IPC invoke from renderer ─────────────────────────────────────────

/**
 * Invoke a channel from the renderer context and return the result.
 * If the channel has been mocked via `mockIpcInvoke`, the mock response
 * is returned (because the ipcMain handler returns it).
 */
export async function invokeIpc(page: Page, channel: string, payload: unknown): Promise<unknown> {
  await waitForApi(page)
  return page.evaluate(
    ([ch, pl]) => {
      const w = window as unknown as {
        electronApi: { invoke: (c: string, p: unknown) => Promise<unknown> }
      }
      return w.electronApi.invoke(ch, pl)
    },
    [channel, payload] as [string, unknown],
  )
}
