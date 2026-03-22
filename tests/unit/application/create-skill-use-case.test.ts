import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { createSkill } from '../../../src/main/application/commands/create-skill-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'
import matter from 'gray-matter'

describe('createSkill', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-skill-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('creates skill file with correct structure', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
      claudePath,
      slug: 'my-skill',
      name: 'My Skill',
      description: 'A test skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['name']).toBe('My Skill')
    expect(parsed.data['description']).toBe('A test skill')
    expect(parsed.data['version']).toBe('1.0.0')
  })

  it('creates skill directory structure', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
      claudePath,
      slug: 'my-skill',
      name: 'My Skill',
      description: 'A test skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.filePath).toBe(
      path.join(claudePath, 'skills', 'my-skill', 'SKILL.md')
    )
    const stat = await fs.stat(result.filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('includes required sections in scaffold', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
      claudePath,
      slug: 'test',
      name: 'Test',
      description: 'Test description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')

    expect(written).toContain('## Purpose')
    expect(written).toContain('## Instructions')
    expect(written).toContain('## Constraints')
  })

  it('returns content in result', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
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

  it('skill file is created in correct directory structure', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
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

  it('handles special characters in slug and name', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
      claudePath,
      slug: 'my-test-skill',
      name: 'My Test Skill (v2)',
      description: 'Test & Description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(result.filePath, 'utf-8')
    const parsed = matter(written)

    expect(parsed.data['name']).toBe('My Test Skill (v2)')
    expect(parsed.data['description']).toBe('Test & Description')
  })

  it('uses version 1.0.0 by default', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
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

  it('creates nested skill directories correctly', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'nested-skill')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
      claudePath,
      slug: 'nested-skill',
      name: 'Nested',
      description: 'Nested skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result.filePath).toContain('nested-skill')
    const stat = await fs.stat(result.filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('overwrites existing skill file', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'test')
    const filePath = path.join(skillDir, 'SKILL.md')
    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(filePath, 'old content')

    const result = await createSkill({
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

  it('returns correct file path in result', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const result = await createSkill({
      claudePath,
      slug: 'my-skill',
      name: 'My Skill',
      description: 'Description',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const expectedPath = path.join(claudePath, 'skills', 'my-skill', 'SKILL.md')
    expect(result.filePath).toBe(expectedPath)
  })
})
