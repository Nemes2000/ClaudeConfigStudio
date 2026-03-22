import { ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  BackupListRequest,
  BackupRollbackRequest,
} from '../../shared/ipc-channels'
import { validatePath } from '../infrastructure/fs/path-validator'
import { listSnapshots } from '../application/commands/list-snapshots-use-case'
import { rollback } from '../application/commands/rollback-use-case'
import {
  buildGraph,
  serializeForCytoscape,
} from '../application/commands/build-graph-use-case'
import { scanWorkspace } from '../application/commands/scan-workspace-use-case'
import type { AppServices } from './app-services'

export function registerBackupHandlers(
  win: BrowserWindow,
  services: AppServices,
): void {
  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, async (_event, req: BackupListRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      const snapshots = await listSnapshots({ filePath, snapshotRepo: services.snapshotRepo })
      return {
        data: snapshots.map((s) => ({
          ...s,
          timestamp: s.timestamp.toISOString(),
        })),
      }
    } catch (err) {
      log.error({ component: 'backup-handlers', op: 'list', err })
      return { error: { code: 'BACKUP_LIST_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_ROLLBACK, async (_event, req: BackupRollbackRequest) => {
    try {
      const originalFilePath = validatePath(req.snapshot.originalFilePath, services.baseDir)
      const snapshotPath = validatePath(req.snapshot.snapshotPath, services.baseDir)

      const result = await rollback({
        snapshot: {
          ...req.snapshot,
          originalFilePath,
          snapshotPath,
          timestamp: new Date(req.snapshot.timestamp),
        },
        snapshotRepo: services.snapshotRepo,
        baseDir: services.baseDir,
      })

      if (result.preRollbackSnapshot) {
        win.webContents.send(IPC_CHANNELS.BACKUP_CREATED, {
          ...result.preRollbackSnapshot,
          timestamp: result.preRollbackSnapshot.timestamp.toISOString(),
        })
      }

      // Rebuild graph
      const { fileEntriesPerFolder } = await scanWorkspace([
        { path: services.baseDir, label: 'workspace' },
      ])
      for (const [, fileEntries] of fileEntriesPerFolder) {
        const graph = buildGraph(fileEntries)
        const cytoscapeElements = serializeForCytoscape(graph)
        win.webContents.send(IPC_CHANNELS.GRAPH_UPDATED, { cytoscapeElements })
      }

      win.webContents.send(IPC_CHANNELS.ROLLBACK_COMPLETED, {
        filePath: originalFilePath,
        restoredContent: result.restoredContent,
      })

      return { data: null }
    } catch (err) {
      log.error({ component: 'backup-handlers', op: 'rollback', err })
      return { error: { code: 'ROLLBACK_FAILED', message: String(err) } }
    }
  })
}
