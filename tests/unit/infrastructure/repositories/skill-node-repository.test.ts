import { SkillNodeRepository } from '@main/infrastructure/repositories/skill-node-repository'
import type { SkillNode } from '@main/domain/models/skill-node'
import * as path from 'path'

jest.mock('fs/promises')
jest.mock('gray-matter')
jest.mock('@main/application/queries/validate-skill-structure-use-case')

import * as fs from 'fs/promises'
import matter from 'gray-matter'
import { extractSectionHeadings } from '@main/application/queries/validate-skill-structure-use-case'

describe('SkillNodeRepository', () => {
  let repo: SkillNodeRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new SkillNodeRepository()
  })

  describe('findBySlug', () => {
    it('should return skill node when file exists', async () => {
      const fullContent = `---
name: Test Skill
description: A test skill
version: 1.0.0
dependencies: [dep1, dep2]
mcp_servers: [mcp1]
diagrams: [diagram1]
triggers: [trigger1]
---
## Purpose
This is a test.

## Instructions
Do this.`

      jest.mocked(fs.readFile).mockResolvedValue(fullContent)
      jest.mocked(matter).mockReturnValue({
        data: {
          name: 'Test Skill',
          description: 'A test skill',
          version: '1.0.0',
          dependencies: ['dep1', 'dep2'],
          mcp_servers: ['mcp1'],
          diagrams: ['diagram1'],
          triggers: ['trigger1'],
        },
        content: '## Purpose\nThis is a test.\n\n## Instructions\nDo this.',
      } as any)
      jest.mocked(extractSectionHeadings).mockReturnValue(['Purpose', 'Instructions'])

      const result = await repo.findBySlug('test-skill', '/home/user/.claude')

      expect(result).toBeDefined()
      expect(result?.slug).toBe('test-skill')
      expect(result?.name).toBe('Test Skill')
      expect(result?.dependencies).toEqual(['dep1', 'dep2'])
      expect(result?.hasPurposeSection).toBe(true)
      expect(result?.hasInstructionsSection).toBe(true)
    })

    it('should return null when file does not exist', async () => {
      jest.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await repo.findBySlug('nonexistent', '/home/user/.claude')

      expect(result).toBeNull()
    })

    it('should construct correct file path', async () => {
      jest.mocked(fs.readFile).mockResolvedValue('---\n---\n')
      jest.mocked(matter).mockReturnValue({
        data: {},
        content: '',
      } as any)

      await repo.findBySlug('my-skill', '/home/user/.claude')

      expect(fs.readFile).toHaveBeenCalledWith(
        path.normalize('/home/user/.claude/skills/my-skill/SKILL.md'),
        'utf-8',
      )
    })

    it('should handle missing frontmatter', async () => {
      jest.mocked(fs.readFile).mockResolvedValue('# Purpose\nNo frontmatter here')

      const result = await repo.findBySlug('no-fm', '/home/user/.claude')

      expect(result?.isMissingFrontmatter).toBe(true)
      expect(result?.name).toBe('no-fm')
      expect(result?.isEnabled).toBe(true)
    })

    it('should use slug as name when not in frontmatter', async () => {
      jest.mocked(fs.readFile).mockResolvedValue('---\ndescription: Test\n---\n')
      jest.mocked(matter).mockReturnValue({
        data: { description: 'Test' },
        content: '',
      } as any)

      const result = await repo.findBySlug('fallback-slug', '/home/user/.claude')

      expect(result?.name).toBe('fallback-slug')
    })
  })

  describe('findAll', () => {
    it('should return all skill nodes from directory', async () => {
      jest.mocked(fs.readdir).mockResolvedValue([
        { name: 'skill1', isDirectory: () => true },
        { name: 'skill2', isDirectory: () => true },
      ] as any)

      jest
        .mocked(fs.readFile)
        .mockResolvedValueOnce('---\nname: Skill1\n---\n')
        .mockResolvedValueOnce('---\nname: Skill2\n---\n')

      jest
        .mocked(matter)
        .mockReturnValueOnce({ data: { name: 'Skill1' }, content: '' } as any)
        .mockReturnValueOnce({ data: { name: 'Skill2' }, content: '' } as any)

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toHaveLength(2)
      expect(result[0]?.name).toBe('Skill1')
      expect(result[1]?.name).toBe('Skill2')
    })

    it('should skip directories without SKILL.md', async () => {
      jest.mocked(fs.readdir).mockResolvedValue([
        { name: 'skill1', isDirectory: () => true },
      ] as any)

      jest.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toEqual([])
    })

    it('should return empty array when skills directory does not exist', async () => {
      jest.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'))

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toEqual([])
    })

    it('should skip non-directories', async () => {
      jest.mocked(fs.readdir).mockResolvedValue([
        { name: 'README.md', isDirectory: () => false },
        { name: 'skill1', isDirectory: () => true },
      ] as any)

      jest.mocked(fs.readFile).mockResolvedValue('---\nname: Skill1\n---\n')
      jest.mocked(matter).mockReturnValue({ data: { name: 'Skill1' }, content: '' } as any)

      const result = await repo.findAll('/home/user/.claude')

      expect(result).toHaveLength(1)
    })
  })

  describe('toggle', () => {
    it('should enable disabled skill', async () => {
      const disabledNode: SkillNode = {
        slug: 'test-skill',
        name: 'Test',
        description: '',
        version: '',
        filePath: '/path/SKILL.md',
        isEnabled: false,
        dependencies: [],
        mcpServers: [],
        diagrams: [],
        triggers: [],
        isMissingFrontmatter: false,
        hasPurposeSection: false,
        hasInstructionsSection: false,
      }

      jest.mocked(fs.readFile).mockResolvedValue('---\nenabled: false\n---\n')
      jest.mocked(matter).mockReturnValue({
        data: { enabled: false },
        content: '',
      } as any)

      // Mock the save method to verify it's called
      const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue(undefined)

      const result = await repo.toggle('test-skill', '/home/user/.claude', true)

      expect(result.isEnabled).toBe(true)
      expect(saveSpy).toHaveBeenCalled()
    })

    it('should throw error if skill not found', async () => {
      jest.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      await expect(repo.toggle('nonexistent', '/home/user/.claude', true)).rejects.toThrow(
        'not found',
      )
    })
  })
})
