import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { deleteSkill } from '../../../src/main/application/commands/delete-skill-use-case'
import type { ISnapshotRepository } from '../../../src/main/application/services/i-snapshot-repository'

describe('deleteSkill', () => {
  let tmpDir: string
  let mockSnapshotRepo: jest.Mocked<ISnapshotRepository>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-skill-test-'))
    mockSnapshotRepo = {
      findByFilePath: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOldest: jest.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('deletes skill directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'my-skill')
    const skillMd = path.join(skillDir, 'SKILL.md')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(skillMd, '# Skill')

    await deleteSkill({
      claudePath,
      slug: 'my-skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const exists = await fs.stat(skillDir).then(
      () => true,
      () => false
    )
    expect(exists).toBe(false)
  })

  it('creates snapshot before deletion', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'my-skill')
    const skillMd = path.join(skillDir, 'SKILL.md')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(skillMd, '# Skill')

    await deleteSkill({
      claudePath,
      slug: 'my-skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalled()
  })

  it('deletes nested files in skill directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'my-skill')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'skill')
    await fs.writeFile(path.join(skillDir, 'README.md'), 'readme')
    await fs.mkdir(path.join(skillDir, 'data'), { recursive: true })
    await fs.writeFile(path.join(skillDir, 'data', 'config.json'), '{}')

    await deleteSkill({
      claudePath,
      slug: 'my-skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const exists = await fs.stat(skillDir).then(
      () => true,
      () => false
    )
    expect(exists).toBe(false)
  })

  it('does not throw when skill directory does not exist', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    // Should not throw
    await expect(
      deleteSkill({
        claudePath,
        slug: 'nonexistent',
        snapshotRepo: mockSnapshotRepo,
        baseDir: tmpDir,
      })
    ).resolves.not.toThrow()
  })

  it('returns undefined on success', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'my-skill')
    const skillMd = path.join(skillDir, 'SKILL.md')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(skillMd, '# Skill')

    const result = await deleteSkill({
      claudePath,
      slug: 'my-skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(result).toBeUndefined()
  })

  it('handles skill with complex directory structure', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'complex-skill')

    await fs.mkdir(path.join(skillDir, 'src'), { recursive: true })
    await fs.mkdir(path.join(skillDir, 'tests'), { recursive: true })

    await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'skill')
    await fs.writeFile(path.join(skillDir, 'src', 'main.js'), 'code')
    await fs.writeFile(path.join(skillDir, 'tests', 'test.js'), 'test')

    await deleteSkill({
      claudePath,
      slug: 'complex-skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const exists = await fs.stat(skillDir).then(
      () => true,
      () => false
    )
    expect(exists).toBe(false)
  })

  it('snapshots the SKILL.md file before deletion', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'test')
    const skillMd = path.join(skillDir, 'SKILL.md')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(skillMd, 'content')

    await deleteSkill({
      claudePath,
      slug: 'test',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    expect(mockSnapshotRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilePath: skillMd,
      })
    )
  })

  it('handles special characters in skill slug', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'my-test-skill')
    const skillMd = path.join(skillDir, 'SKILL.md')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(skillMd, '# Skill')

    await deleteSkill({
      claudePath,
      slug: 'my-test-skill',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const exists = await fs.stat(skillDir).then(
      () => true,
      () => false
    )
    expect(exists).toBe(false)
  })

  it('only deletes the specified skill directory', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillsDir = path.join(claudePath, 'skills')
    const skill1Dir = path.join(skillsDir, 'skill-1')
    const skill2Dir = path.join(skillsDir, 'skill-2')

    await fs.mkdir(skill1Dir, { recursive: true })
    await fs.mkdir(skill2Dir, { recursive: true })

    await fs.writeFile(path.join(skill1Dir, 'SKILL.md'), 'skill1')
    await fs.writeFile(path.join(skill2Dir, 'SKILL.md'), 'skill2')

    await deleteSkill({
      claudePath,
      slug: 'skill-1',
      snapshotRepo: mockSnapshotRepo,
      baseDir: tmpDir,
    })

    const skill1Exists = await fs.stat(skill1Dir).then(
      () => true,
      () => false
    )
    const skill2Exists = await fs.stat(skill2Dir).then(
      () => true,
      () => false
    )

    expect(skill1Exists).toBe(false)
    expect(skill2Exists).toBe(true)
  })
})
