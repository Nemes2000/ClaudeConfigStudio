import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  FileReadRequest,
  FileWriteRequest,
  FileDeleteRequest,
  FileSectionUpdateRequest,
  FileSectionDeleteRequest,
  FileSectionAddRequest,
  FileItemAddRequest,
  FileItemUpdateRequest,
  FileItemDeleteRequest,
  FileItemReorderRequest,
} from '../../shared/ipc-channels'
import { validatePath } from '../infrastructure/fs/path-validator'
import { writeFile } from '../application/commands/write-file-use-case'
import {
  updateFileSection,
  deleteFileSection,
  addFileSection,
} from '../application/commands/update-file-section-use-case'
import {
  addItem,
  updateItem,
  deleteItem,
  reorderItem,
} from '../application/commands/item-crud-use-cases'
import type { AppServices } from './app-services'

export function registerFileHandlers(services: AppServices): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, req: FileReadRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      const content = await fs.readFile(filePath, 'utf-8')
      return { data: { content } }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'read', err })
      return { error: { code: 'FILE_READ_FAILED', message: 'Could not read file' } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, req: FileWriteRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await writeFile({
        filePath,
        content: req.content,
        snapshotRepo: services.snapshotRepo,
        baseDir: services.baseDir,
      })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'write', err })
      return { error: { code: 'FILE_WRITE_FAILED', message: 'Could not write file' } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, req: FileDeleteRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await fs.unlink(filePath)
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'delete', err })
      return { error: { code: 'FILE_DELETE_FAILED', message: 'Could not delete file' } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_UPDATE_SECTION, async (_event, req: FileSectionUpdateRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await updateFileSection({ filePath, sectionHeading: req.sectionHeading, newContent: req.newContent, snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'update-section', err })
      return { error: { code: 'SECTION_UPDATE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE_SECTION, async (_event, req: FileSectionDeleteRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await deleteFileSection({ filePath, sectionHeading: req.sectionHeading, snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'delete-section', err })
      return { error: { code: 'SECTION_DELETE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_ADD_SECTION, async (_event, req: FileSectionAddRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await addFileSection({ filePath, sectionHeading: req.sectionHeading, content: req.content, ...(req.afterSection !== undefined ? { afterSection: req.afterSection } : {}), snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'add-section', err })
      return { error: { code: 'SECTION_ADD_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_ADD_ITEM, async (_event, req: FileItemAddRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await addItem({ filePath, sectionHeading: req.sectionHeading, itemContent: req.itemContent, ...(req.afterIndex !== undefined ? { afterIndex: req.afterIndex } : {}), snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'add-item', err })
      return { error: { code: 'ITEM_ADD_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_UPDATE_ITEM, async (_event, req: FileItemUpdateRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await updateItem({ filePath, sectionHeading: req.sectionHeading, itemIndex: req.itemIndex, newContent: req.newContent, snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'update-item', err })
      return { error: { code: 'ITEM_UPDATE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE_ITEM, async (_event, req: FileItemDeleteRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await deleteItem({ filePath, sectionHeading: req.sectionHeading, itemIndex: req.itemIndex, snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'delete-item', err })
      return { error: { code: 'ITEM_DELETE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_REORDER_ITEM, async (_event, req: FileItemReorderRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await reorderItem({ filePath, sectionHeading: req.sectionHeading, fromIndex: req.fromIndex, toIndex: req.toIndex, snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'file-handlers', op: 'reorder-item', err })
      return { error: { code: 'ITEM_REORDER_FAILED', message: String(err) } }
    }
  })
}
