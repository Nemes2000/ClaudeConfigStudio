import { listSnapshots } from '../../../src/main/application/commands/list-snapshots-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'
import type { Snapshot } from '../../../src/main/domain/models/snapshot'

describe('listSnapshots', () => {
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(() => {
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  it('returns snapshots from repository', async () => {
    const filePath = '/path/to/file.md'
    const snapshots: Snapshot[] = [
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot1.md',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sizeBytes: 100,
        previewLine: 'Preview 1',
      },
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot2.md',
        timestamp: new Date('2024-01-02T10:00:00Z'),
        sizeBytes: 200,
        previewLine: 'Preview 2',
      },
    ]

    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce(snapshots)

    const result = await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(result).toHaveLength(2)
    expect(mockSnapshotRepo.findByFilePath).toHaveBeenCalledWith(filePath)
  })

  it('sorts snapshots newest-first', async () => {
    const filePath = '/path/to/file.md'
    const snapshots: Snapshot[] = [
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot1.md',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sizeBytes: 100,
        previewLine: 'Preview 1',
      },
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot3.md',
        timestamp: new Date('2024-01-03T10:00:00Z'),
        sizeBytes: 300,
        previewLine: 'Preview 3',
      },
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot2.md',
        timestamp: new Date('2024-01-02T10:00:00Z'),
        sizeBytes: 200,
        previewLine: 'Preview 2',
      },
    ]

    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce(snapshots)

    const result = await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(result[0]!.timestamp.getTime()).toBe(
      new Date('2024-01-03T10:00:00Z').getTime()
    )
    expect(result[1]!.timestamp.getTime()).toBe(
      new Date('2024-01-02T10:00:00Z').getTime()
    )
    expect(result[2]!.timestamp.getTime()).toBe(
      new Date('2024-01-01T10:00:00Z').getTime()
    )
  })

  it('returns empty array when no snapshots exist', async () => {
    const filePath = '/path/to/file.md'
    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce([])

    const result = await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(result).toHaveLength(0)
  })

  it('returns single snapshot unchanged', async () => {
    const filePath = '/path/to/file.md'
    const snapshot: Snapshot = {
      originalFilePath: filePath,
      snapshotPath: '/path/to/.backups/snapshot.md',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 100,
      previewLine: 'Preview',
    }

    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce([snapshot])

    const result = await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(snapshot)
  })

  it('preserves snapshot properties after sorting', async () => {
    const filePath = '/path/to/file.md'
    const snapshot1: Snapshot = {
      originalFilePath: filePath,
      snapshotPath: '/path/to/.backups/snapshot1.md',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      sizeBytes: 100,
      previewLine: 'Preview 1',
    }
    const snapshot2: Snapshot = {
      originalFilePath: filePath,
      snapshotPath: '/path/to/.backups/snapshot2.md',
      timestamp: new Date('2024-01-02T10:00:00Z'),
      sizeBytes: 200,
      previewLine: 'Preview 2',
    }

    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce([snapshot1, snapshot2])

    const result = await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(result[0]!.sizeBytes).toBe(200)
    expect(result[0]!.previewLine).toBe('Preview 2')
    expect(result[1]!.sizeBytes).toBe(100)
    expect(result[1]!.previewLine).toBe('Preview 1')
  })

  it('handles timestamps with same date but different times', async () => {
    const filePath = '/path/to/file.md'
    const snapshots: Snapshot[] = [
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot1.md',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sizeBytes: 100,
        previewLine: 'Preview 1',
      },
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot2.md',
        timestamp: new Date('2024-01-01T14:30:00Z'),
        sizeBytes: 200,
        previewLine: 'Preview 2',
      },
      {
        originalFilePath: filePath,
        snapshotPath: '/path/to/.backups/snapshot3.md',
        timestamp: new Date('2024-01-01T09:00:00Z'),
        sizeBytes: 300,
        previewLine: 'Preview 3',
      },
    ]

    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce(snapshots)

    const result = await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(result[0]!.timestamp.getTime()).toBe(
      new Date('2024-01-01T14:30:00Z').getTime()
    )
    expect(result[1]!.timestamp.getTime()).toBe(
      new Date('2024-01-01T10:00:00Z').getTime()
    )
    expect(result[2]!.timestamp.getTime()).toBe(
      new Date('2024-01-01T09:00:00Z').getTime()
    )
  })

  it('calls repository with correct file path', async () => {
    const filePath = '/some/path/to/file.md'
    mockSnapshotRepo.findByFilePath.mockResolvedValueOnce([])

    await listSnapshots({
      filePath,
      snapshotRepo: mockSnapshotRepo,
    })

    expect(mockSnapshotRepo.findByFilePath).toHaveBeenCalledWith(filePath)
  })
})
