import type { ISnapshotRepository } from '../services/i-snapshot-repository'
import type { Snapshot } from '../../domain/models/snapshot'

export interface ListSnapshotsParams {
  filePath: string
  snapshotRepo: ISnapshotRepository
}

/**
 * Returns snapshots for a file sorted newest-first.
 */
export async function listSnapshots(
  params: ListSnapshotsParams,
): Promise<Snapshot[]> {
  const { filePath, snapshotRepo } = params
  const snapshots = await snapshotRepo.findByFilePath(filePath)
  return snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}
