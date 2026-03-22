import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { SnapshotRepository } from '../../../src/main/infrastructure/repositories/snapshot-repository'
import type { Snapshot } from '../../../src/main/domain/models/snapshot'

describe('SnapshotRepository', () => {
  let tmpDir: string
  let repo: SnapshotRepository

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-repo-test-'))
    repo = new SnapshotRepository()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('save', () => {
    it('writes snapshot file content', async () => {
      const originalFile = path.join(tmpDir, 'file.md')
      const snapshotPath = path.join(tmpDir, '.backups', 'file', '2024-01-01T10-00-00-000Z.md')

      await fs.mkdir(path.dirname(originalFile), { recursive: true })
      await fs.writeFile(originalFile, 'Original content')

      const snapshot: Snapshot = {
        originalFilePath: originalFile,
        snapshotPath,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sizeBytes: 16,
        previewLine: 'Original content',
      }

      await repo.save(snapshot)

      const snapshotContent = await fs.readFile(snapshotPath, 'utf-8')
      expect(snapshotContent).toBe('Original content')
    })

    it('creates parent directories for snapshot', async () => {
      const originalFile = path.join(tmpDir, 'file.md')
      const snapshotPath = path.join(tmpDir, '.backups', 'deep', 'nested', 'file', '2024-01-01T10-00-00-000Z.md')

      await fs.mkdir(path.dirname(originalFile), { recursive: true })
      await fs.writeFile(originalFile, 'Content')

      const snapshot: Snapshot = {
        originalFilePath: originalFile,
        snapshotPath,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sizeBytes: 7,
        previewLine: 'Content',
      }

      await repo.save(snapshot)

      const stat = await fs.stat(snapshotPath)
      expect(stat.isFile()).toBe(true)
    })
  })

  describe('findByFilePath', () => {
    it('returns empty array when no snapshots exist', async () => {
      const filePath = path.join(tmpDir, 'nonexistent.md')
      const snapshots = await repo.findByFilePath(filePath)

      expect(snapshots).toEqual([])
    })

    it('finds snapshots for a file', async () => {
      const filePath = path.join(tmpDir, '.claude', 'rules', 'my-rule.md')
      const backupDir = path.join(tmpDir, '.claude', '.backups', 'rules', 'my-rule')

      await fs.mkdir(backupDir, { recursive: true })
      await fs.writeFile(path.join(backupDir, '2024-01-01T10-00-00-000Z.md'), 'Snapshot 1')
      await fs.writeFile(path.join(backupDir, '2024-01-02T10-00-00-000Z.md'), 'Snapshot 2')

      const snapshots = await repo.findByFilePath(filePath)

      expect(snapshots).toHaveLength(2)
      expect(snapshots.every((s) => s.originalFilePath === filePath)).toBe(true)
    })

    it('extracts timestamp from snapshot filename', async () => {
      const filePath = path.join(tmpDir, '.claude', 'rules', 'rule.md')
      const backupDir = path.join(tmpDir, '.claude', '.backups', 'rules', 'rule')

      await fs.mkdir(backupDir, { recursive: true })
      await fs.writeFile(path.join(backupDir, '2026-03-15T10-30-45-500Z.md'), 'Content')

      const snapshots = await repo.findByFilePath(filePath)

      expect(snapshots).toHaveLength(1)
      expect(snapshots[0]!.timestamp.getUTCFullYear()).toBe(2026)
      expect(snapshots[0]!.timestamp.getUTCMonth()).toBe(2) // March
      expect(snapshots[0]!.timestamp.getUTCDate()).toBe(15)
    })

    it('extracts preview line from snapshot content', async () => {
      const filePath = path.join(tmpDir, '.claude', 'rules', 'rule.md')
      const backupDir = path.join(tmpDir, '.claude', '.backups', 'rules', 'rule')

      await fs.mkdir(backupDir, { recursive: true })
      await fs.writeFile(
        path.join(backupDir, '2024-01-01T10-00-00-000Z.md'),
        '\n\n# My Heading\n\nOther content'
      )

      const snapshots = await repo.findByFilePath(filePath)

      expect(snapshots[0]!.previewLine).toBe('# My Heading')
    })

    it('handles missing snapshot files gracefully', async () => {
      const filePath = path.join(tmpDir, '.claude', 'rules', 'rule.md')
      const backupDir = path.join(tmpDir, '.claude', '.backups', 'rules', 'rule')

      await fs.mkdir(backupDir, { recursive: true })
      // Create a file, then remove it to simulate a missing file
      await fs.writeFile(path.join(backupDir, 'corrupted.md'), 'Content')
      await fs.rm(path.join(backupDir, 'corrupted.md'))

      // Should not throw
      const snapshots = await repo.findByFilePath(filePath)

      expect(snapshots).toEqual([])
    })
  })

  describe('deleteOldest', () => {
    it('keeps specified number of newest snapshots', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      await fs.mkdir(backupDir, { recursive: true })

      // Create files with names that sort lexicographically
      await fs.writeFile(path.join(backupDir, '2024-01-01T10-00-00-000Z'), 'Old')
      await fs.writeFile(path.join(backupDir, '2024-01-02T10-00-00-000Z'), 'Middle')
      await fs.writeFile(path.join(backupDir, '2024-01-03T10-00-00-000Z'), 'New')

      await repo.deleteOldest(backupDir, 2)

      const files = await fs.readdir(backupDir)
      expect(files).toHaveLength(2)
      expect(files).toContain('2024-01-02T10-00-00-000Z')
      expect(files).toContain('2024-01-03T10-00-00-000Z')
    })

    it('deletes nothing when count is at limit', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      await fs.mkdir(backupDir, { recursive: true })

      await fs.writeFile(path.join(backupDir, 'file1'), 'Content 1')
      await fs.writeFile(path.join(backupDir, 'file2'), 'Content 2')

      await repo.deleteOldest(backupDir, 2)

      const files = await fs.readdir(backupDir)
      expect(files).toHaveLength(2)
    })

    it('deletes all when count exceeds by many', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      await fs.mkdir(backupDir, { recursive: true })

      await fs.writeFile(path.join(backupDir, '2024-01-01T10-00-00-000Z'), 'Old')
      await fs.writeFile(path.join(backupDir, '2024-01-02T10-00-00-000Z'), 'Middle')
      await fs.writeFile(path.join(backupDir, '2024-01-03T10-00-00-000Z'), 'New')

      await repo.deleteOldest(backupDir, 1)

      const files = await fs.readdir(backupDir)
      expect(files).toHaveLength(1)
      expect(files[0]).toBe('2024-01-03T10-00-00-000Z')
    })

    it('does not throw when directory does not exist', async () => {
      const nonexistentDir = path.join(tmpDir, 'nonexistent')

      await expect(repo.deleteOldest(nonexistentDir, 5)).resolves.not.toThrow()
    })

    it('only deletes files, not directories', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      await fs.mkdir(backupDir, { recursive: true })

      await fs.writeFile(path.join(backupDir, '2024-01-01T10-00-00-000Z'), 'File')
      await fs.mkdir(path.join(backupDir, 'subdir'))

      await repo.deleteOldest(backupDir, 0)

      const entries = await fs.readdir(backupDir, { withFileTypes: true })
      expect(entries.filter((e) => e.isFile())).toHaveLength(0)
      expect(entries.filter((e) => e.isDirectory())).toHaveLength(1)
    })
  })

  describe('backupDir calculation', () => {
    it('places backups in .backups adjacent to .claude', async () => {
      const filePath = path.join(tmpDir, 'project', '.claude', 'rules', 'rule.md')

      // Write a test file to avoid path resolution issues
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, 'Test')

      const snapshot: Snapshot = {
        originalFilePath: filePath,
        snapshotPath: path.join(tmpDir, 'project', '.claude', '.backups', 'rules', 'rule', '2024-01-01T10-00-00-000Z.md'),
        timestamp: new Date(),
        sizeBytes: 4,
        previewLine: 'Test',
      }

      await repo.save(snapshot)

      const stat = await fs.stat(snapshot.snapshotPath)
      expect(stat.isFile()).toBe(true)
    })
  })
})
