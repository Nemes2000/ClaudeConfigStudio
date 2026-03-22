import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import matter from 'gray-matter'
import { createRuleSupplement } from '../../../src/main/application/commands/create-rule-supplement-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'

describe('createRuleSupplement', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-supplement-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('creates supplement file with correct structure', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'coding',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['supplements']).toBe('coding')
    expect(parsed.data['version']).toBe('1.0.0')
  })

  it('creates supplement in correct directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'coding',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.filePath).toBe(path.join(claudePath, 'rules', 'coding.md'))
    const stat = await fs.stat(result.filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('includes required sections in scaffold', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')

    expect(written).toContain('## Additions')
    expect(written).toContain('## Overrides')
    expect(written).toContain('## Exclusions')
  })

  it('includes supplements field referencing global rule', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'my-rule',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['supplements']).toBe('my-rule')
  })

  it('includes project supplement label in name', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'coding',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['name']).toContain('coding')
    expect(parsed.data['name']).toContain('project supplement')
  })

  it('returns content in result', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.content).toContain('supplements: test')
    expect(result.content).toContain('## Additions')
    expect(result.content).toContain('## Overrides')
    expect(result.content).toContain('## Exclusions')
  })

  it('supplement file is created in correct directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const stat = await fs.stat(result.filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('uses version 1.0.0 by default', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['version']).toBe('1.0.0')
  })

  it('handles special characters in global slug', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'my-test-rule',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['supplements']).toBe('my-test-rule')
    expect(parsed.data['name']).toContain('my-test-rule')
  })

  it('overwrites existing supplement file', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const rulesDir = path.join(claudePath, 'rules')
    const filePath = path.join(rulesDir, 'test.md')

    await fs.mkdir(rulesDir, { recursive: true })
    await fs.writeFile(filePath, 'old supplement')

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['supplements']).toBe('test')
  })

  it('creates rules directory if it does not exist', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    await createRuleSupplement({
      claudePath,
      globalSlug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const rulesDir = path.join(claudePath, 'rules')
    const stat = await fs.stat(rulesDir)
    expect(stat.isDirectory()).toBe(true)
  })

  it('returns correct file path in result', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRuleSupplement({
      claudePath,
      globalSlug: 'api-rules',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const expectedPath = path.join(claudePath, 'rules', 'api-rules.md')
    expect(result.filePath).toBe(expectedPath)
  })
})
