import * as fs from 'fs/promises'
import * as path from 'path'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { snapshotFile } from './snapshot-file-use-case'

export interface DeleteSkillParams {
  claudePath: string
  slug: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function deleteSkill(params: DeleteSkillParams): Promise<void> {
  const { claudePath, slug, snapshotRepo, baseDir } = params
  const skillDir = path.join(claudePath, 'skills', slug)
  const skillMd = path.join(skillDir, 'SKILL.md')

  // Snapshot before deletion
  await snapshotFile({ filePath: skillMd, snapshotRepo, baseDir })

  // Recursively delete the skill directory
  await fs.rm(skillDir, { recursive: true, force: true })
}
