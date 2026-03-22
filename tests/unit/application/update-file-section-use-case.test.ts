import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  updateFileSection,
  deleteFileSection,
  addFileSection,
} from '../../../src/main/application/commands/update-file-section-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'
import { SectionRequiredError } from '../../../src/main/domain/exceptions'

describe('updateFileSection', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'update-section-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('updates existing section content', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Old purpose content

## Instructions

Instructions here`

    await fs.writeFile(filePath, content)

    await updateFileSection({
      filePath,
      sectionHeading: 'Purpose',
      newContent: 'New purpose content',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('New purpose content')
    expect(written).not.toContain('Old purpose content')
  })

  it('appends section if not found', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Purpose content`

    await fs.writeFile(filePath, content)

    await updateFileSection({
      filePath,
      sectionHeading: 'Examples',
      newContent: 'Example content',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('## Examples')
    expect(written).toContain('Example content')
  })

  it('preserves other sections', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Purpose

## Instructions

Instructions

## Constraints

Constraints`

    await fs.writeFile(filePath, content)

    await updateFileSection({
      filePath,
      sectionHeading: 'Instructions',
      newContent: 'New instructions',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('## Purpose')
    expect(written).toContain('Purpose')
    expect(written).toContain('## Constraints')
    expect(written).toContain('Constraints')
  })

  it('creates snapshot before updating', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Purpose\n\nOld')

    await updateFileSection({
      filePath,
      sectionHeading: 'Purpose',
      newContent: 'New',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })
})

describe('deleteFileSection', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-section-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('deletes optional section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Purpose

## Examples

Examples here

## Instructions

Instructions`

    await fs.writeFile(filePath, content)

    await deleteFileSection({
      filePath,
      sectionHeading: 'Examples',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).not.toContain('## Examples')
    expect(written).not.toContain('Examples here')
    expect(written).toContain('## Purpose')
    expect(written).toContain('## Instructions')
  })

  it('throws when deleting required section Purpose', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Purpose\n\nContent')

    await expect(
      deleteFileSection({
        filePath,
        sectionHeading: 'Purpose',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(SectionRequiredError)
  })

  it('throws when deleting required section Instructions', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Instructions\n\nContent')

    await expect(
      deleteFileSection({
        filePath,
        sectionHeading: 'Instructions',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(SectionRequiredError)
  })

  it('throws when deleting required section Rules', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Rules\n\nContent')

    await expect(
      deleteFileSection({
        filePath,
        sectionHeading: 'Rules',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow(SectionRequiredError)
  })

  it('creates snapshot before deletion', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Optional\n\nContent')

    await deleteFileSection({
      filePath,
      sectionHeading: 'Optional',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('removes extra whitespace after deletion', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Content



## Optional

Optional content



## Instructions

Instructions`

    await fs.writeFile(filePath, content)

    await deleteFileSection({
      filePath,
      sectionHeading: 'Optional',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    // Should not have more than 2 consecutive newlines
    expect(written).not.toMatch(/\n{3,}/)
  })
})

describe('addFileSection', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'add-section-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('appends section at end of file', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Purpose content`

    await fs.writeFile(filePath, content)

    await addFileSection({
      filePath,
      sectionHeading: 'Examples',
      content: 'Example content here',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('## Examples')
    expect(written).toContain('Example content here')
    expect(written).toMatch(/Purpose content.*Examples/s)
  })

  it('inserts section after specified section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Purpose

## Instructions

Instructions

## Constraints

Constraints`

    await fs.writeFile(filePath, content)

    await addFileSection({
      filePath,
      sectionHeading: 'Examples',
      content: 'Example content',
      afterSection: 'Purpose',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const purposeIdx = written.indexOf('## Purpose')
    const examplesIdx = written.indexOf('## Examples')
    const instructionsIdx = written.indexOf('## Instructions')

    expect(purposeIdx).toBeLessThan(examplesIdx)
    expect(examplesIdx).toBeLessThan(instructionsIdx)
  })

  it('appends when afterSection not found', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Purpose

Content`

    await fs.writeFile(filePath, content)

    await addFileSection({
      filePath,
      sectionHeading: 'Examples',
      content: 'Example content',
      afterSection: 'NonExistent',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('## Examples')
    expect(written).toContain('Example content')
  })

  it('creates snapshot before adding', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, 'content')

    await addFileSection({
      filePath,
      sectionHeading: 'New',
      content: 'New content',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('formats section heading correctly', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Purpose\n\nContent')

    await addFileSection({
      filePath,
      sectionHeading: 'MySection',
      content: 'My content',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toContain('## MySection')
  })
})
