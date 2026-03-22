import { ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  ProjectScanRequest,
  ProjectCreateRequest,
} from '../../shared/ipc-channels'
import { validatePath } from '../infrastructure/fs/path-validator'
import { scanWorkspace } from '../application/commands/scan-workspace-use-case'
import {
  buildGraph,
  serializeForCytoscape,
} from '../application/commands/build-graph-use-case'
import type { AppServices } from './app-services'
import * as fs from 'fs/promises'
import * as path from 'path'

export function registerProjectHandlers(
  win: BrowserWindow,
  services: AppServices,
): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_SCAN, async (_event, req: ProjectScanRequest) => {
    try {
      const { folders, fileEntriesPerFolder } = await scanWorkspace(req.workspaceFolders)
      for (const folder of folders) {
        const fileEntries = fileEntriesPerFolder.get(folder.claudePath) ?? []
        const graph = buildGraph(fileEntries)
        const cytoscapeElements = serializeForCytoscape(graph)

        win.webContents.send(IPC_CHANNELS.PROJECT_DISCOVERED, {
          folder,
          cytoscapeElements,
        })

        // Start file watcher
        services.startWatcher(folder.claudePath, (changedPath) => {
          win.webContents.send(IPC_CHANNELS.CONFIG_CHANGED, { filePath: changedPath })
        })
      }
      log.info({ component: 'project-handlers', op: 'scan', folderCount: folders.length })
      return { data: null }
    } catch (err) {
      log.error({ component: 'project-handlers', op: 'scan', err })
      return { error: { code: 'SCAN_FAILED', message: 'Workspace scan failed' } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return services.listDiscoveredFolders()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, req: ProjectCreateRequest) => {
    try {
      const validated = validatePath(req.targetPath, services.baseDir)
      await fs.mkdir(path.join(validated, '.claude', 'skills'), { recursive: true })
      await fs.mkdir(path.join(validated, '.claude', 'rules'), { recursive: true })
      await fs.mkdir(path.join(validated, '.claude', 'hooks'), { recursive: true })
      await fs.mkdir(path.join(validated, '.claude', 'mcp'), { recursive: true })
      log.info({ component: 'project-handlers', op: 'create', path: validated })
      return { data: null }
    } catch (err) {
      log.error({ component: 'project-handlers', op: 'create', err })
      return { error: { code: 'CREATE_FAILED', message: 'Project creation failed' } }
    }
  })
}
