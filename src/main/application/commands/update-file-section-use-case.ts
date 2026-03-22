import * as fs from 'fs/promises'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { writeFile } from './write-file-use-case'
import { SectionRequiredError } from '../../domain/exceptions'

const REQUIRED_SECTIONS = new Set(['Purpose', 'Instructions', 'Rules'])

export interface UpdateFileSectionParams {
  filePath: string
  sectionHeading: string
  newContent: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function updateFileSection(
  params: UpdateFileSectionParams,
): Promise<void> {
  const { filePath, sectionHeading, newContent, snapshotRepo, baseDir } = params
  const content = await fs.readFile(filePath, 'utf-8')
  const updated = replaceSectionContent(content, sectionHeading, newContent)
  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

export interface DeleteFileSectionParams {
  filePath: string
  sectionHeading: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function deleteFileSection(
  params: DeleteFileSectionParams,
): Promise<void> {
  const { filePath, sectionHeading, snapshotRepo, baseDir } = params
  if (REQUIRED_SECTIONS.has(sectionHeading)) {
    throw new SectionRequiredError(sectionHeading)
  }
  const content = await fs.readFile(filePath, 'utf-8')
  const updated = removeSectionBlock(content, sectionHeading)
  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

export interface AddFileSectionParams {
  filePath: string
  sectionHeading: string
  content: string
  afterSection?: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function addFileSection(
  params: AddFileSectionParams,
): Promise<void> {
  const { filePath, sectionHeading, content, afterSection, snapshotRepo, baseDir } =
    params
  const existing = await fs.readFile(filePath, 'utf-8')
  const newBlock = `\n## ${sectionHeading}\n\n${content}\n`
  let updated: string

  if (afterSection) {
    updated = insertAfterSection(existing, afterSection, newBlock)
  } else {
    updated = existing + newBlock
  }

  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

// ── Section manipulation helpers ──────────────────────────────────────────────

function replaceSectionContent(
  content: string,
  heading: string,
  newContent: string,
): string {
  const escapedHeading = escapeRegex(heading)
  const re = new RegExp(
    `(^##\\s+${escapedHeading}\\s*\\n)([\\s\\S]*?)(?=^##\\s|\\Z)`,
    'gm',
  )
  if (re.test(content)) {
    return content.replace(re, `$1\n${newContent}\n`)
  }
  // Section not found — append
  return content + `\n## ${heading}\n\n${newContent}\n`
}

function removeSectionBlock(content: string, heading: string): string {
  const escapedHeading = escapeRegex(heading)
  const re = new RegExp(
    `^##\\s+${escapedHeading}\\s*\\n[\\s\\S]*?(?=^##\\s|\\Z)`,
    'gm',
  )
  return content.replace(re, '').replace(/\n{3,}/g, '\n\n')
}

function insertAfterSection(
  content: string,
  afterSection: string,
  newBlock: string,
): string {
  const escapedHeading = escapeRegex(afterSection)
  const re = new RegExp(
    `(^##\\s+${escapedHeading}\\s*\\n[\\s\\S]*?)(?=^##\\s|\\Z)`,
    'gm',
  )
  if (re.test(content)) {
    return content.replace(re, `$1${newBlock}`)
  }
  return content + newBlock
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
