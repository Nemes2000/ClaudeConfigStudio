import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import matter from 'gray-matter'
import { createRule } from '../../../src/main/application/commands/create-rule-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'

describe('createRule', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-rule-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('creates rule file with correct structure', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'my-rule',
      name: 'My Rule',
      description: 'A test rule',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['name']).toBe('My Rule')
    expect(parsed.data['description']).toBe('A test rule')
    expect(parsed.data['version']).toBe('1.0.0')
  })

  it('creates rule in correct directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'my-rule',
      name: 'My Rule',
      description: 'A test rule',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.filePath).toBe(path.join(claudePath, 'rules', 'my-rule.md'))
    const stat = await fs.stat(result.filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('includes required sections in scaffold', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')

    expect(written).toContain('## Purpose')
    expect(written).toContain('## Rules')
  })

  it('includes paths field when provided', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      paths: 'src/**/*.ts',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['paths']).toBe('src/**/*.ts')
  })

  it('omits paths field when not provided', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect('paths' in parsed.data).toBe(false)
  })

  it('returns content in result', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.content).toContain('name: Test')
    expect(result.content).toContain('description: Test description')
    expect(result.content).toContain('## Purpose')
  })

  it('rule file is created in correct directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const stat = await fs.stat(result.filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('uses version 1.0.0 by default', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['version']).toBe('1.0.0')
  })

  it('handles special characters in name and description', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test-rule',
      name: 'Test & Rule (v2)',
      description: 'Description with "quotes"',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['name']).toBe('Test & Rule (v2)')
    expect(parsed.data['description']).toBe('Description with "quotes"')
  })

  it('overwrites existing rule file', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const rulesDir = path.join(claudePath, 'rules')
    const filePath = path.join(rulesDir, 'test.md')

    await fs.mkdir(rulesDir, { recursive: true })
    await fs.writeFile(filePath, 'old content')

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Updated',
      description: 'Updated description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['name']).toBe('Updated')
  })

  it('creates rules directory if it does not exist', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const rulesDir = path.join(claudePath, 'rules')
    const stat = await fs.stat(rulesDir)
    expect(stat.isDirectory()).toBe(true)
  })

  it('includes paths in frontmatter when provided', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'typescript-rule',
      name: 'TypeScript Rule',
      description: 'For TypeScript files',
      paths: 'src/**/*.ts',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')

    expect(written).toContain('paths: src/**/*.ts')
  })

  it('returns correct file path in result', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createRule({
      claudePath,
      slug: 'my-rule',
      name: 'My Rule',
      description: 'Description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const expectedPath = path.join(claudePath, 'rules', 'my-rule.md')
    expect(result.filePath).toBe(expectedPath)
  })
})
