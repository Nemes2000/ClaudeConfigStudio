import chokidar, { type FSWatcher } from 'chokidar'
import log from 'electron-log'

export interface FileWatcher {
  stop(): Promise<void>
}

export type FileChangeCallback = (filePath: string) => void

/**
 * Starts a chokidar watcher on the given path.
 * On change/add/unlink emits the file path via onChanged callback.
 * Restarts automatically up to maxRetries times on error.
 */
export function startWatcher(
  watchPath: string,
  onChanged: FileChangeCallback,
  maxRetries = 3,
): FileWatcher {
  let retries = 0
  let watcher: FSWatcher | null = null

  function create(): void {
    watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      ignored: /(^|[/\\])\..backups/,
    })

    watcher
      .on('change', (p) => onChanged(p))
      .on('add', (p) => onChanged(p))
      .on('unlink', (p) => onChanged(p))
      .on('error', (err) => {
        log.error({ component: 'chokidar-watcher', path: watchPath, err })
        if (retries < maxRetries) {
          retries++
          const delay = Math.pow(2, retries) * 1000
          setTimeout(() => {
            watcher?.close().catch(() => {})
            create()
          }, delay)
        }
      })
  }

  create()

  return {
    async stop() {
      await watcher?.close()
    },
  }
}
