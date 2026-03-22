import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { writeFile } from '../../../src/main/application/commands/write-file-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'
import { BackupFailedError } from '../../../src/main/domain/exceptions'

describe('writeFile', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-file-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes content to file', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = '# Hello World'

    await writeFile({
      filePath,
      content,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe(content)
  })

  it('creates parent directories', async () => {
    const filePath = path.join(tmpDir, 'deep', 'nested', 'dir', 'test.md')
    const content = 'nested content'

    await writeFile({
      filePath,
      content,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe(content)
  })

  it('creates snapshot before writing', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const originalContent = 'Original content'
    await fs.writeFile(filePath, originalContent)

    await writeFile({
      filePath,
      content: 'New content',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('throws BackupFailedError when snapshot fails', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'original')

    mockSnapshotRepo.save.mockRejectedValueOnce(new Error('Backup failed'))

    await expect(
      writeFile({
        filePath,
        content: 'new content',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(BackupFailedError)
  })

  it('does not write file if snapshot fails', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const originalContent = 'Original'
    await fs.writeFile(filePath, originalContent)

    mockSnapshotRepo.save.mockRejectedValueOnce(new Error('Backup failed'))

    try {
      await writeFile({
        filePath,
        content: 'Should not be written',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    } catch {
      // expected
    }

    // File should still have original content
    const current = await fs.readFile(filePath, 'utf-8')
    expect(current).toBe(originalContent)
  })

  it('leaves no .tmp file on success', async () => {
    const filePath = path.join(tmpDir, 'test.md')

    await writeFile({
      filePath,
      content: 'content',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const files = await fs.readdir(tmpDir)
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('overwrites existing file', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'original')

    await writeFile({
      filePath,
      content: 'updated',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe('updated')
  })

  it('uses UTF-8 encoding', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = 'Special chars: é, ñ, 中文'

    await writeFile({
      filePath,
      content,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe(content)
  })

  it('includes error message from failed snapshot', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    // Create the file so snapshotFile will try to snapshot it
    await fs.writeFile(filePath, 'existing')

    const error = new Error('Permission denied')
    mockSnapshotRepo.save.mockRejectedValueOnce(error)

    await expect(
      writeFile({
        filePath,
        content: 'test',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(BackupFailedError)
  })

  it('handles non-Error rejection from snapshot', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    // Create the file so snapshotFile will try to snapshot it
    await fs.writeFile(filePath, 'existing')

    mockSnapshotRepo.save.mockRejectedValueOnce('String error')

    await expect(
      writeFile({
        filePath,
        content: 'test',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(BackupFailedError)
  })

  it('returns undefined on success', async () => {
    const filePath = path.join(tmpDir, 'test.md')

    const result = await writeFile({
      filePath,
      content: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result).toBeUndefined()
  })

  it('handles empty content', async () => {
    const filePath = path.join(tmpDir, 'test.md')

    await writeFile({
      filePath,
      content: '',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe('')
  })
})
