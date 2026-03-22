import * as fs from 'fs/promises'
import * as path from 'path'
import type { ISnapshotRepository } from '../../application/services/i-snapshot-repository'
import type { Snapshot } from '../../domain/models/snapshot'
import { atomicWrite } from '../fs/atomic-write'

export class SnapshotRepository implements ISnapshotRepository {
  async findByFilePath(absoluteFilePath: string): Promise<Snapshot[]> {
    const dir = this.backupDir(absoluteFilePath)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const snapshots: Snapshot[] = []
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const snapshotPath = path.join(dir, entry.name)
        try {
          const content = await fs.readFile(snapshotPath, 'utf-8')
          const stat = await fs.stat(snapshotPath)
          const previewLine =
            content
              .split('\n')
              .find((l) => l.trim().length > 0)
              ?.slice(0, 120) ?? ''
          // Timestamp embedded in filename: YYYY-MM-DDTHH-MM-SS-mmmZ.md
          const tsRaw = path.basename(entry.name, path.extname(entry.name))
          // Filename: YYYY-MM-DDTHH-MM-SS-mmmZ → replace dashes after T with colons/dot
          const tsFixed = tsRaw.replace(
            /T(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/,
            'T$1:$2:$3.$4Z',
          )
          const timestamp = new Date(tsFixed)
          snapshots.push({
            originalFilePath: absoluteFilePath,
            snapshotPath,
            timestamp: isNaN(timestamp.getTime()) ? stat.mtime : timestamp,
            sizeBytes: stat.size,
            previewLine,
          })
        } catch {
          // Skip corrupted snapshot entries
        }
      }
      return snapshots
    } catch {
      return []
    }
  }

  async save(snapshot: Snapshot): Promise<void> {
    const snapshotContent = await fs.readFile(snapshot.originalFilePath, 'utf-8')
    await atomicWrite(snapshot.snapshotPath, snapshotContent)
  }

  async deleteOldest(directory: string, keep: number): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true })
      const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort()
      // Sort by name (ISO timestamps sort lexicographically)
      if (files.length > keep) {
        const toDelete = files.slice(0, files.length - keep)
        for (const name of toDelete) {
          await fs.unlink(path.join(directory, name)).catch(() => {})
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }

  private backupDir(filePath: string): string {
    // Place backups adjacent to .claude/: .backups/<relative-path-to-file>/
    const claudeIdx = filePath.lastIndexOf('.claude')
    if (claudeIdx === -1) return path.join(path.dirname(filePath), '.backups')
    const claudeBase = filePath.slice(0, claudeIdx)
    const relative = filePath.slice(claudeIdx + '.claude'.length + 1)
    return path.join(claudeBase, '.claude', '.backups', path.dirname(relative), path.basename(filePath, path.extname(filePath)))
  }
}
