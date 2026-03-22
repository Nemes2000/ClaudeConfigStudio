export interface Snapshot {
  readonly originalFilePath: string
  readonly snapshotPath: string
  readonly timestamp: Date
  readonly sizeBytes: number
  readonly previewLine: string
}

export function isNewerThan(a: Snapshot, b: Snapshot): boolean {
  return a.timestamp.getTime() > b.timestamp.getTime()
}

export interface BackupPolicy {
  readonly maxSnapshotsPerFile: number
}

export function exceedsLimit(policy: BackupPolicy, count: number): boolean {
  return count > policy.maxSnapshotsPerFile
}

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  maxSnapshotsPerFile: 50,
}
