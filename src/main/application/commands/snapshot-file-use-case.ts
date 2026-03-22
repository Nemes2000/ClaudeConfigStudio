import * as fs from 'fs/promises'
import * as path from 'path'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import type { Snapshot } from '../../domain/models/snapshot'
import { DEFAULT_BACKUP_POLICY } from '../../domain/models/snapshot'

export interface SnapshotFileParams {
  filePath: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

/**
 * Creates a timestamped backup snapshot of a file before mutation.
 * If the file does not exist (new file), returns null without error.
 */
export async function snapshotFile(
  params: SnapshotFileParams,
): Promise<Snapshot | null> {
  const { filePath, snapshotRepo, baseDir } = params

  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch {
    // File doesn't exist yet — no snapshot needed
    return null
  }

  const stats = await fs.stat(filePath)
  const relative = path.relative(baseDir, filePath)
  const timestamp = new Date()
  const tsStr = timestamp.toISOString().replace(/[:.]/g, '-')
  const ext = path.extname(filePath) || '.md'
  const snapshotPath = path.join(
    baseDir,
    '.backups',
    path.dirname(relative),
    path.basename(filePath, ext),
    `${tsStr}${ext}`,
  )

  const lines = content.split('\n')
  const previewLine = lines.find((l) => l.trim().length > 0) ?? ''

  const snapshot: Snapshot = {
    originalFilePath: filePath,
    snapshotPath,
    timestamp,
    sizeBytes: stats.size,
    previewLine: previewLine.slice(0, 120),
  }

  await snapshotRepo.save(snapshot)
  await snapshotRepo.deleteOldest(
    path.dirname(snapshotPath),
    DEFAULT_BACKUP_POLICY.maxSnapshotsPerFile,
  )

  return snapshot
}
