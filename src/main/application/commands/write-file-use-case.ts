import * as fs from 'fs/promises'
import * as path from 'path'
import { BackupFailedError } from '../../domain/exceptions'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import { snapshotFile } from './snapshot-file-use-case'

export interface WriteFileParams {
  filePath: string
  content: string
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

/**
 * Backup-first write: snapshot → atomic write → return.
 * Throws BackupFailedError if snapshot fails (write is aborted).
 */
export async function writeFile(params: WriteFileParams): Promise<void> {
  const { filePath, content, snapshotRepo, baseDir } = params

  // Snapshot existing file (if it exists) before writing
  try {
    await snapshotFile({ filePath, snapshotRepo, baseDir })
  } catch (err) {
    throw new BackupFailedError(filePath, err instanceof Error ? err.message : String(err))
  }

  // Atomic write: write to .tmp then rename
  const tmpPath = `${filePath}.tmp`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(tmpPath, content, { encoding: 'utf-8', mode: 0o600 })
  await fs.rename(tmpPath, filePath)
}
