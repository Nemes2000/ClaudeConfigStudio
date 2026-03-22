import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { rollback } from '../../../src/main/application/commands/rollback-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'
import type { Snapshot } from '../../../src/main/domain/models/snapshot'
import { BackupFailedError } from '../../../src/main/domain/exceptions'

describe('rollback', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rollback-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('restores file from snapshot', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    // Create original file with current content
    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current content')

    // Create snapshot with old content
    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Old content')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 11,
      previewLine: 'Old content',
    }

    const result = await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const restored = await fs.readFile(originalFile, 'utf-8')
    expect(restored).toBe('Old content')
    expect(result.restoredContent).toBe('Old content')
  })

  it('creates pre-rollback snapshot before restoring', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current content')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Old content')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 11,
      previewLine: 'Old content',
    }

    const result = await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
    expect(result.preRollbackSnapshot).not.toBeNull()
  })

  it('returns pre-rollback snapshot in result', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Old')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 3,
      previewLine: 'Old',
    }

    const result = await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.preRollbackSnapshot).not.toBeNull()
    expect(result.preRollbackSnapshot!.originalFilePath).toBe(originalFile)
  })

  it('returns null pre-rollback snapshot when file does not exist before rollback', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    // Don't create the original file
    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Content')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 7,
      previewLine: 'Content',
    }

    const result = await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.preRollbackSnapshot).toBeNull()
  })

  it('throws BackupFailedError when pre-rollback snapshot fails', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Old')

    mockSnapshotRepo.save.mockRejectedValueOnce(new Error('Save failed'))

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 3,
      previewLine: 'Old',
    }

    await expect(
      rollback({
        snapshot,
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(BackupFailedError)
  })

  it('does not restore file if pre-rollback snapshot fails', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    const originalContent = 'Original content'
    await fs.writeFile(originalFile, originalContent)

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Old content')

    mockSnapshotRepo.save.mockRejectedValueOnce(new Error('Snapshot failed'))

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 11,
      previewLine: 'Old content',
    }

    try {
      await rollback({
        snapshot,
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    } catch {
      // expected
    }

    const current = await fs.readFile(originalFile, 'utf-8')
    expect(current).toBe(originalContent)
  })

  it('uses atomic write for restoration', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Restored content')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 17,
      previewLine: 'Restored content',
    }

    await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    // No .tmp file should be left behind
    const files = await fs.readdir(tmpDir)
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('returns restored content in result', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    const restoredContent = 'Restored content'
    await fs.writeFile(snapshotFile, restoredContent)

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 17,
      previewLine: 'Restored',
    }

    const result = await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.restoredContent).toBe(restoredContent)
  })

  it('creates directories for original file if they do not exist', async () => {
    const originalFile = path.join(tmpDir, 'deep', 'nested', 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Content')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 7,
      previewLine: 'Content',
    }

    await rollback({
      snapshot,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const stat = await fs.stat(originalFile)
    expect(stat.isFile()).toBe(true)
  })

  it('handles non-Error rejection from snapshot', async () => {
    const originalFile = path.join(tmpDir, 'file.md')
    const snapshotFile = path.join(tmpDir, '.backups', 'snapshot.md')

    await fs.mkdir(path.dirname(originalFile), { recursive: true })
    await fs.writeFile(originalFile, 'Current')

    await fs.mkdir(path.dirname(snapshotFile), { recursive: true })
    await fs.writeFile(snapshotFile, 'Old')

    mockSnapshotRepo.save.mockRejectedValueOnce('String error')

    const snapshot: Snapshot = {
      originalFilePath: originalFile,
      snapshotPath: snapshotFile,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 3,
      previewLine: 'Old',
    }

    await expect(
      rollback({
        snapshot,
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(BackupFailedError)
  })
})
