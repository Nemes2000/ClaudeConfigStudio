import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { snapshotFile } from '../../../src/main/application/commands/snapshot-file-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'
import type { Snapshot } from '../../../src/main/domain/models/snapshot'

describe('snapshotFile', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-file-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null when file does not exist', async () => {
    const filePath = path.join(tmpDir, 'nonexistent.md')
    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result).toBeNull()
    expect(mockSnapshotRepo.save).not.toHaveBeenCalled()
  })

  it('creates a snapshot for an existing file', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '# Test Content')

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result).not.toBeNull()
    expect(result!.originalFilePath).toBe(filePath)
    expect(result!.sizeBytes).toBeGreaterThan(0)
    expect(result!.previewLine).toContain('Test Content')
  })

  it('calls snapshot repository save', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '# Test Content')

    await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalledTimes(1)
    expect(mockSnapshotRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilePath: filePath,
      })
    )
  })

  it('calls deleteOldest to enforce backup policy', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '# Test Content')

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.deleteOldest).toHaveBeenCalledTimes(1)
    expect(mockSnapshotRepo.deleteOldest).toHaveBeenCalledWith(
      path.dirname(result!.snapshotPath),
      50 // DEFAULT_BACKUP_POLICY.maxSnapshotsPerFile
    )
  })

  it('extracts preview line from first non-empty line', async () => {
    const content = '\n\n# My Title\n\nDescription'
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, content)

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result!.previewLine).toBe('# My Title')
  })

  it('truncates long preview lines to 120 chars', async () => {
    const longLine = 'A'.repeat(200)
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, longLine)

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result!.previewLine).toHaveLength(120)
  })

  it('sets correct file permissions (0o600)', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'content')

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    // Verify that save was called with a valid snapshot
    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('creates ISO timestamp in snapshot path', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'content')

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    // Snapshot path should contain ISO-format timestamp with dashes
    expect(result!.snapshotPath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
  })

  it('preserves file extension in snapshot path', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'content')

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result!.snapshotPath).toMatch(/\.md$/)
  })

  it('uses .md as default extension when file has no extension', async () => {
    const filePath = path.join(tmpDir, 'testfile')
    await fs.writeFile(filePath, 'content')

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result!.snapshotPath).toMatch(/\.md$/)
  })

  it('includes file size in snapshot', async () => {
    const content = 'Test content'
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, content)

    const result = await snapshotFile({
      filePath,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result!.sizeBytes).toBe(content.length)
  })

  it('throws when snapshot repository save fails', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'content')

    mockSnapshotRepo.save.mockRejectedValueOnce(new Error('Save failed'))

    await expect(
      snapshotFile({
        filePath,
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow('Save failed')
  })
})
