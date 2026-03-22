import { ipcMain } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  SkillToggleRequest,
  SkillCreateRequest,
  SkillDeleteRequest,
  SkillValidateStructureRequest,
} from '../../shared/ipc-channels'
import { validatePath } from '../infrastructure/fs/path-validator'
import { toggleSkill } from '../application/commands/toggle-skill-use-case'
import { createSkill } from '../application/commands/create-skill-use-case'
import { deleteSkill } from '../application/commands/delete-skill-use-case'
import { validateSkillStructure } from '../application/queries/validate-skill-structure-use-case'
import type { AppServices } from './app-services'

export function registerSkillHandlers(services: AppServices): void {
  ipcMain.handle(IPC_CHANNELS.SKILL_TOGGLE, async (_event, req: SkillToggleRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      await toggleSkill({ filePath, enabled: req.enabled, snapshotRepo: services.snapshotRepo, baseDir: services.baseDir })
      return { data: null }
    } catch (err) {
      log.error({ component: 'skill-handlers', op: 'toggle', err })
      return { error: { code: 'SKILL_TOGGLE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_CREATE, async (_event, req: SkillCreateRequest) => {
    try {
      validatePath(req.claudePath, services.baseDir)
      const result = await createSkill({
        claudePath: req.claudePath,
        slug: sanitizeSlug(req.slug),
        name: req.name,
        description: req.description,
        snapshotRepo: services.snapshotRepo,
        baseDir: services.baseDir,
      })
      return { data: result }
    } catch (err) {
      log.error({ component: 'skill-handlers', op: 'create', err })
      return { error: { code: 'SKILL_CREATE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_DELETE, async (_event, req: SkillDeleteRequest) => {
    try {
      validatePath(req.claudePath, services.baseDir)
      await deleteSkill({
        claudePath: req.claudePath,
        slug: sanitizeSlug(req.slug),
        snapshotRepo: services.snapshotRepo,
        baseDir: services.baseDir,
      })
      return { data: null }
    } catch (err) {
      log.error({ component: 'skill-handlers', op: 'delete', err })
      return { error: { code: 'SKILL_DELETE_FAILED', message: String(err) } }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_VALIDATE_STRUCTURE, async (_event, req: SkillValidateStructureRequest) => {
    try {
      const filePath = validatePath(req.filePath, services.baseDir)
      const result = await validateSkillStructure({ filePath })
      return { data: result }
    } catch (err) {
      log.error({ component: 'skill-handlers', op: 'validate-structure', err })
      return { error: { code: 'VALIDATE_FAILED', message: String(err) } }
    }
  })
}

/** Strip path separators and dangerous characters from slug */
function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '')
}
