import { deleteRule } from '@main/application/commands/delete-rule-use-case'
import type { ISnapshotRepository } from '@main/application/services/i-snapshot-repository'
import * as path from 'path'

jest.mock('fs/promises')
jest.mock('@main/application/commands/snapshot-file-use-case')

import * as fs from 'fs/promises'
import { snapshotFile } from '@main/application/commands/snapshot-file-use-case'

describe('deleteRule', () => {
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSnapshotRepo = {
      findByFilePath: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(snapshotFile).mockResolvedValue(null)
    jest.mocked(fs.unlink).mockResolvedValue(undefined)
  })

  it('should snapshot the file before deleting', async () => {
    await deleteRule({
      claudePath: '/home/user/.claude',
      slug: 'test-rule',
      snapshotRepo: mockSnapshotRepo,
      baseDir: '/home/user',
    })

    expect(snapshotFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: path.normalize('/home/user/.claude/rules/test-rule.md'),
        snapshotRepo: mockSnapshotRepo,
        baseDir: '/home/user',
      }),
    )
  })

  it('should delete the rule file after snapshotting', async () => {
    await deleteRule({
      claudePath: '/home/user/.claude',
      slug: 'my-rule',
      snapshotRepo: mockSnapshotRepo,
      baseDir: '/home/user',
    })

    expect(fs.unlink).toHaveBeenCalledWith(path.normalize('/home/user/.claude/rules/my-rule.md'))
  })

  it('should construct correct file path from slug', async () => {
    await deleteRule({
      claudePath: '/home/user/.claude',
      slug: 'complex-rule-name',
      snapshotRepo: mockSnapshotRepo,
      baseDir: '/home/user',
    })

    expect(fs.unlink).toHaveBeenCalledWith(path.normalize('/home/user/.claude/rules/complex-rule-name.md'))
  })

  it('should throw error if file deletion fails', async () => {
    const deleteError = new Error('Permission denied')
    jest.mocked(fs.unlink).mockRejectedValue(deleteError)

    await expect(
      deleteRule({
        claudePath: '/home/user/.claude',
        slug: 'test-rule',
        snapshotRepo: mockSnapshotRepo,
        baseDir: '/home/user',
      }),
    ).rejects.toThrow(deleteError)
  })

  it('should throw error if snapshot fails', async () => {
    const snapshotError = new Error('Snapshot failed')
    jest.mocked(snapshotFile).mockRejectedValue(snapshotError)

    await expect(
      deleteRule({
        claudePath: '/home/user/.claude',
        slug: 'test-rule',
        snapshotRepo: mockSnapshotRepo,
        baseDir: '/home/user',
      }),
    ).rejects.toThrow(snapshotError)

    // File should not be deleted if snapshot fails
    expect(fs.unlink).not.toHaveBeenCalled()
  })
})
