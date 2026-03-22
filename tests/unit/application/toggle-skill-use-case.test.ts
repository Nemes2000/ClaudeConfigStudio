import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import matter from 'gray-matter'
import { toggleSkill } from '../../../src/main/application/commands/toggle-skill-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'

describe('toggleSkill', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'toggle-skill-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('disables a skill by adding enabled: false', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Test Skill
description: A test skill
---

## Purpose

Test purpose
`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: false,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(written)
    expect(parsed.data['enabled']).toBe(false)
  })

  it('calls writeFile to persist enabled state', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Test Skill
description: A test skill
enabled: false
---

## Purpose

Test purpose
`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: true,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    // Verify writeFile was called (which saves the changes)
    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('preserves other frontmatter when disabling', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Test Skill
description: A test skill
version: 1.0.0
author: John Doe
---

## Purpose

Test purpose
`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: false,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(written)
    expect(parsed.data['name']).toBe('Test Skill')
    expect(parsed.data['description']).toBe('A test skill')
    expect(parsed.data['version']).toBe('1.0.0')
    expect(parsed.data['author']).toBe('John Doe')
    expect(parsed.data['enabled']).toBe(false)
  })

  it('preserves content when toggling', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const bodyContent = `## Purpose

Important information

## Instructions

1. Do this
2. Do that`

    const content = `---
name: Test Skill
---

${bodyContent}`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: false,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(written)
    expect(parsed.content.trim()).toBe(bodyContent.trim())
  })

  it('calls snapshot repository through writeFile', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Test Skill
---

## Purpose
Test`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: false,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('handles file with minimal frontmatter', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Minimal
---

Content`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: false,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(written)
    expect(parsed.data['name']).toBe('Minimal')
    expect(parsed.data['enabled']).toBe(false)
  })

  it('removes enabled field when re-enabling', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Test Skill
enabled: false
---

Content`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: true,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(written)
    expect('enabled' in parsed.data).toBe(false)
  })

  it('throws when file does not exist', async () => {
    const filePath = path.join(tmpDir, 'nonexistent.md')

    await expect(
      toggleSkill({
        filePath,
        enabled: false,
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).rejects.toThrow()
  })

  it('creates backup snapshot before toggling', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    await fs.writeFile(filePath, '---\nname: Test\n---\n\nContent')

    await toggleSkill({
      filePath,
      enabled: false,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('handles enabled field being true explicitly', async () => {
    const filePath = path.join(tmpDir, 'SKILL.md')
    const content = `---
name: Test Skill
enabled: true
---

Content`
    await fs.writeFile(filePath, content)

    await toggleSkill({
      filePath,
      enabled: true,
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const written = await fs.readFile(filePath, 'utf-8')
    const parsed = matter(written)
    expect('enabled' in parsed.data).toBe(false)
  })
})
