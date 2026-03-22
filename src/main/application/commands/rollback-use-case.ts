import * as fs from 'fs/promises'
import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import type { Snapshot } from '../../domain/models/snapshot'
import { snapshotFile } from './snapshot-file-use-case'
import { BackupFailedError } from '../../domain/exceptions'

export interface RollbackParams {
  snapshot: Snapshot
  snapshotRepo: ISnapshotRepository
  baseDir: string
}

export interface RollbackResult {
  restoredContent: string
  preRollbackSnapshot: Snapshot | null
}

/**
 * Rollback is always reversible: a pre-rollback snapshot is created first.
 * If the pre-rollback snapshot fails, the rollback is aborted.
 */
export async function rollback(params: RollbackParams): Promise<RollbackResult> {
  const { snapshot, snapshotRepo, baseDir } = params

  // Step 1: Pre-rollback snapshot of the current state
  let preRollbackSnapshot: Snapshot | null = null
  try {
    preRollbackSnapshot = await snapshotFile({
      filePath: snapshot.originalFilePath,
      snapshotRepo,
      baseDir,
    })
  } catch (err) {
    throw new BackupFailedError(
      snapshot.originalFilePath,
      err instanceof Error ? err.message : String(err),
    )
  }

  // Step 2: Read the selected snapshot content
  const restoredContent = await fs.readFile(snapshot.snapshotPath, 'utf-8')

  // Step 3: Write the restored content atomically
  const tmpPath = `${snapshot.originalFilePath}.tmp`
  await fs.writeFile(tmpPath, restoredContent, { encoding: 'utf-8', mode: 0o600 })
  await fs.rename(tmpPath, snapshot.originalFilePath)

  return { restoredContent, preRollbackSnapshot }
}
