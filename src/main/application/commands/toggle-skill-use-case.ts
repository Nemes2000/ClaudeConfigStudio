import matter from 'gray-matter'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { writeFile } from './write-file-use-case'

export interface ToggleSkillParams {
  filePath: string
  enabled: boolean
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

/**
 * Enables or disables a skill/rule/hook by writing enabled:false to frontmatter,
 * or removing the enabled field entirely when re-enabling.
 * Wrapped in WriteFileUseCase (snapshot-first).
 */
export async function toggleSkill(params: ToggleSkillParams): Promise<void> {
  const { filePath, enabled, snapshotRepo, baseDir } = params
  const { readFile } = await import('fs/promises')
  const currentContent = await readFile(filePath, 'utf-8')
  const parsed = matter(currentContent)

  if (enabled) {
    // Remove enabled field entirely — file stays clean by default
    delete parsed.data['enabled']
  } else {
    parsed.data['enabled'] = false
  }

  const newContent = matter.stringify(parsed.content, parsed.data)
  await writeFile({ filePath, content: newContent, snapshotRepo, baseDir })
}
