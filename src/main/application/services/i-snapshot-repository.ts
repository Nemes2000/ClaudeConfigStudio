import type { Snapshot } from '../../domain/models/snapshot'

export interface ISnapshotRepository {
  findByFilePath(absoluteFilePath: string): Promise<Snapshot[]>
  save(snapshot: Snapshot): Promise<void>
  deleteOldest(directory: string, keep: number): Promise<void>
}
