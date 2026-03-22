import * as fs from 'fs/promises'
import * as path from 'path'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { snapshotFile } from './snapshot-file-use-case'

export interface DeleteRuleParams {
  claudePath: string
  slug: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function deleteRule(params: DeleteRuleParams): Promise<void> {
  const { claudePath, slug, snapshotRepo, baseDir } = params
  const filePath = path.join(claudePath, 'rules', `${slug}.md`)
  await snapshotFile({ filePath, snapshotRepo, baseDir })
  await fs.unlink(filePath)
}
