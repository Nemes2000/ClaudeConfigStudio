import * as fs from 'fs/promises'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { writeFile } from './write-file-use-case'

const NUMBERED_SECTIONS = new Set([
  'Instructions',
  'Rules',
  'Additions',
  'Overrides',
  'Exclusions',
])

export interface ItemParams {
  filePath: string
  sectionHeading: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export async function addItem(
  params: ItemParams & { itemContent: string; afterIndex?: number },
): Promise<void> {
  const { filePath, sectionHeading, itemContent, afterIndex, snapshotRepo, baseDir } =
    params
  const content = await fs.readFile(filePath, 'utf-8')
  const isNumbered = NUMBERED_SECTIONS.has(sectionHeading)
  const updated = insertItem(content, sectionHeading, itemContent, afterIndex, isNumbered)
  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

export async function updateItem(
  params: ItemParams & { itemIndex: number; newContent: string },
): Promise<void> {
  const { filePath, sectionHeading, itemIndex, newContent, snapshotRepo, baseDir } =
    params
  const content = await fs.readFile(filePath, 'utf-8')
  const isNumbered = NUMBERED_SECTIONS.has(sectionHeading)
  const updated = replaceItem(content, sectionHeading, itemIndex, newContent, isNumbered)
  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

export async function deleteItem(
  params: ItemParams & { itemIndex: number },
): Promise<void> {
  const { filePath, sectionHeading, itemIndex, snapshotRepo, baseDir } = params
  const content = await fs.readFile(filePath, 'utf-8')
  const isNumbered = NUMBERED_SECTIONS.has(sectionHeading)
  const updated = removeItem(content, sectionHeading, itemIndex, isNumbered)
  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

export async function reorderItem(
  params: ItemParams & { fromIndex: number; toIndex: number },
): Promise<void> {
  const { filePath, sectionHeading, fromIndex, toIndex, snapshotRepo, baseDir } =
    params
  const content = await fs.readFile(filePath, 'utf-8')
  const isNumbered = NUMBERED_SECTIONS.has(sectionHeading)
  const updated = moveItem(content, sectionHeading, fromIndex, toIndex, isNumbered)
  await writeFile({ filePath, content: updated, snapshotRepo, baseDir })
}

// ── List manipulation helpers ──────────────────────────────────────────────────

function extractSectionItems(content: string, heading: string): string[] {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `^##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`,
    'gm',
  )
  const match = re.exec(content)
  if (!match?.[1]) return []
  return match[1]
    .split('\n')
    .filter((l) => /^(\d+\.\s+|-\s+|\*\s+)/.test(l))
    .map((l) => l.replace(/^(\d+\.\s+|-\s+|\*\s+)/, '').trim())
}

function rebuildSection(
  content: string,
  heading: string,
  items: string[],
  isNumbered: boolean,
): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `(^##\\s+${escapedHeading}\\s*\\n)([\\s\\S]*?)(?=^##\\s|$)`,
    'gm',
  )
  const itemLines = items
    .map((item, idx) => (isNumbered ? `${idx + 1}. ${item}` : `- ${item}`))
    .join('\n')
  return content.replace(re, `$1\n${itemLines}\n\n`)
}

function insertItem(
  content: string,
  heading: string,
  itemContent: string,
  afterIndex: number | undefined,
  isNumbered: boolean,
): string {
  const items = extractSectionItems(content, heading)
  const insertAt = afterIndex !== undefined ? afterIndex + 1 : items.length
  items.splice(insertAt, 0, itemContent)
  return rebuildSection(content, heading, items, isNumbered)
}

function replaceItem(
  content: string,
  heading: string,
  itemIndex: number,
  newContent: string,
  isNumbered: boolean,
): string {
  const items = extractSectionItems(content, heading)
  if (itemIndex >= 0 && itemIndex < items.length) {
    items[itemIndex] = newContent
  }
  return rebuildSection(content, heading, items, isNumbered)
}

function removeItem(
  content: string,
  heading: string,
  itemIndex: number,
  isNumbered: boolean,
): string {
  const items = extractSectionItems(content, heading)
  items.splice(itemIndex, 1)
  return rebuildSection(content, heading, items, isNumbered)
}

function moveItem(
  content: string,
  heading: string,
  fromIndex: number,
  toIndex: number,
  isNumbered: boolean,
): string {
  const items = extractSectionItems(content, heading)
  const [item] = items.splice(fromIndex, 1)
  if (item !== undefined) {
    items.splice(toIndex, 0, item)
  }
  return rebuildSection(content, heading, items, isNumbered)
}
