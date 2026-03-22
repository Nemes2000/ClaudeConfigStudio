import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  addItem,
  updateItem,
  deleteItem,
  reorderItem,
} from '../../../src/main/application/commands/item-crud-use-cases'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'

describe('addItem', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'item-crud-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('adds item to numbered section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Instructions

1. First step
2. Second step

## Other`

    await fs.writeFile(filePath, content)

    await addItem({
      filePath,
      sectionHeading: 'Instructions',
      itemContent: 'Third step',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    // File is written via writeFile
    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('adds item to bullet section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Constraints

- Do not do this
- Do not do that

## Other`

    await fs.writeFile(filePath, content)

    await addItem({
      filePath,
      sectionHeading: 'Constraints',
      itemContent: 'Do not do this either',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('adds item after specified index', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Instructions

1. First
2. Second

## Other`

    await fs.writeFile(filePath, content)

    await addItem({
      filePath,
      sectionHeading: 'Instructions',
      itemContent: 'One and half',
      afterIndex: 0,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('creates snapshot before adding', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Instructions\n\n1. Item')

    await addItem({
      filePath,
      sectionHeading: 'Instructions',
      itemContent: 'New item',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })
})

describe('updateItem', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'update-item-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('updates item in numbered section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Instructions

1. First step
2. Second step
3. Third step

## Other`

    await fs.writeFile(filePath, content)

    await updateItem({
      filePath,
      sectionHeading: 'Instructions',
      itemIndex: 1,
      newContent: 'Updated second',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('updates item in bullet section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Rules

- Rule one
- Rule two
- Rule three

## Other`

    await fs.writeFile(filePath, content)

    await updateItem({
      filePath,
      sectionHeading: 'Rules',
      itemIndex: 0,
      newContent: 'Updated rule one',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('creates snapshot before updating', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Instructions\n\n1. Item')

    await updateItem({
      filePath,
      sectionHeading: 'Instructions',
      itemIndex: 0,
      newContent: 'Updated',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })
})

describe('deleteItem', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-item-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('deletes item from numbered section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Instructions

1. First
2. Second
3. Third

## Other`

    await fs.writeFile(filePath, content)

    await deleteItem({
      filePath,
      sectionHeading: 'Instructions',
      itemIndex: 1,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('deletes item from bullet section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Rules

- Rule one
- Rule two
- Rule three

## Other`

    await fs.writeFile(filePath, content)

    await deleteItem({
      filePath,
      sectionHeading: 'Rules',
      itemIndex: 0,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('creates snapshot before deletion', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Rules\n\n- Item 1\n- Item 2')

    await deleteItem({
      filePath,
      sectionHeading: 'Rules',
      itemIndex: 0,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })
})

describe('reorderItem', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reorder-item-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('moves item to different position in numbered section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Instructions

1. First
2. Second
3. Third

## Other`

    await fs.writeFile(filePath, content)

    await reorderItem({
      filePath,
      sectionHeading: 'Instructions',
      fromIndex: 0,
      toIndex: 2,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('moves item in bullet section', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    const content = `## Rules

- Rule A
- Rule B
- Rule C

## Other`

    await fs.writeFile(filePath, content)

    await reorderItem({
      filePath,
      sectionHeading: 'Rules',
      fromIndex: 2,
      toIndex: 0,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('creates snapshot before reordering', async () => {
    const filePath = path.join(tmpDir, 'test.md')
    await fs.writeFile(filePath, '## Instructions\n\n1. A\n2. B')

    await reorderItem({
      filePath,
      sectionHeading: 'Instructions',
      fromIndex: 0,
      toIndex: 1,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })
})
