import { resolveRuleHierarchy } from '@main/application/queries/resolve-rule-hierarchy-use-case'
import * as path from 'path'

jest.mock('fs/promises')
jest.mock('gray-matter')
jest.mock('os')

import * as fs from 'fs/promises'
import matter from 'gray-matter'
import { homedir } from 'os'

describe('resolveRuleHierarchy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(homedir).mockReturnValue('/home/user')
  })

  it('should resolve rule hierarchy from global and project directories', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: string | any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [
          { name: 'rule1.md', isFile: () => true, isDirectory: () => false },
          { name: 'rule2.md', isFile: () => true, isDirectory: () => false },
        ] as any
      } else if (dir === path.normalize('/proj/.claude/rules')) {
        return [
          { name: 'rule1.md', isFile: () => true, isDirectory: () => false },
        ] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockImplementation(async (filePath: string | any) => {
      if (filePath === path.normalize('/home/user/.claude/rules/rule1.md')) {
        return '---\nenabled: true\n---\n'
      } else if (filePath === path.normalize('/home/user/.claude/rules/rule2.md')) {
        return '---\nenabled: true\n---\n'
      } else if (filePath === path.normalize('/proj/.claude/rules/rule1.md')) {
        return '---\nenabled: false\n---\n'
      }
      return ''
    })

    jest.mocked(matter).mockImplementation((content: any) => ({
      data: { enabled: content.includes('enabled: false') ? false : true },
      content: '',
    } as any))

    const result = await resolveRuleHierarchy({ claudePath: '/proj/.claude' })

    expect(result).toHaveLength(2)
    expect(result[0]!.slug).toBe('rule1')
    expect(result[0]!.globalPath).toBe(path.normalize('/home/user/.claude/rules/rule1.md'))
    expect(result[0]!.supplementPath).toBe(path.normalize('/proj/.claude/rules/rule1.md'))
    expect(result[1]!.slug).toBe('rule2')
    expect(result[1]!.supplementPath).toBeNull()
  })

  it('should return enabled status from frontmatter', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [{ name: 'test.md', isFile: () => true, isDirectory: () => false }] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\nenabled: false\n---\n')

    jest.mocked(matter).mockReturnValue({
      data: { enabled: false },
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj' })

    expect(result[0]!.isGlobalEnabled).toBe(false)
  })

  it('should default to enabled=true if not specified in frontmatter', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [{ name: 'test.md', isFile: () => true, isDirectory: () => false }] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\nother: value\n---\n')

    jest.mocked(matter).mockReturnValue({
      data: { other: 'value' },
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj' })

    expect(result[0]!.isGlobalEnabled).toBe(true)
  })

  it('should handle missing global rules directory', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        throw new Error('ENOENT')
      } else if (dir === path.normalize('/proj/.claude/rules')) {
        return [{ name: 'rule.md', isFile: () => true, isDirectory: () => false }] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\n---\n')
    jest.mocked(matter).mockReturnValue({
      data: {},
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj/.claude' })

    expect(result).toHaveLength(0)
  })

  it('should handle missing project rules directory', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [{ name: 'rule.md', isFile: () => true, isDirectory: () => false }] as any
      } else if (dir === path.normalize('/proj/.claude/rules')) {
        throw new Error('ENOENT')
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\n---\n')
    jest.mocked(matter).mockReturnValue({
      data: {},
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj/.claude' })

    expect(result).toHaveLength(1)
    expect(result[0]!.supplementPath).toBeNull()
  })

  it('should skip non-markdown files', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [
          { name: 'rule.md', isFile: () => true, isDirectory: () => false },
          { name: 'README', isFile: () => true, isDirectory: () => false },
          { name: '.gitignore', isFile: () => true, isDirectory: () => false },
        ] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\n---\n')
    jest.mocked(matter).mockReturnValue({
      data: {},
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj' })

    expect(result).toHaveLength(1)
    expect(result[0]!.slug).toBe('rule')
  })

  it('should skip directories', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [
          { name: 'rule.md', isFile: () => true, isDirectory: () => false },
          { name: 'subdir', isFile: () => false, isDirectory: () => true },
        ] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\n---\n')
    jest.mocked(matter).mockReturnValue({
      data: {},
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj' })

    expect(result).toHaveLength(1)
    expect(result[0]!.slug).toBe('rule')
  })

  it('should set isSupplementEnabled=null when no supplement exists', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [{ name: 'rule.md', isFile: () => true, isDirectory: () => false }] as any
      } else if (dir === path.normalize('/proj/.claude/rules')) {
        return []
      }
      return []
    })

    jest.mocked(fs.readFile).mockResolvedValue('---\nenabled: true\n---\n')
    jest.mocked(matter).mockReturnValue({
      data: { enabled: true },
      content: '',
    } as any)

    const result = await resolveRuleHierarchy({ claudePath: '/proj/.claude' })

    expect(result[0]!.supplementPath).toBeNull()
    expect(result[0]!.isSupplementEnabled).toBeNull()
  })

  it('should return supplement enabled status when supplement exists', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [{ name: 'rule.md', isFile: () => true, isDirectory: () => false }] as any
      } else if (dir === path.normalize('/proj/.claude/rules')) {
        return [{ name: 'rule.md', isFile: () => true, isDirectory: () => false }] as any
      }
      return []
    })

    let callCount = 0
    jest.mocked(fs.readFile).mockImplementation(async (path: string | any) => {
      callCount++
      if (callCount === 1) {
        return '---\nenabled: true\n---\n'
      } else {
        return '---\nenabled: false\n---\n'
      }
    })

    jest.mocked(matter).mockImplementation((content: any) => ({
      data: { enabled: !content.includes('enabled: false') },
      content: '',
    } as any))

    const result = await resolveRuleHierarchy({ claudePath: '/proj/.claude' })

    expect(result[0]!.isSupplementEnabled).toBe(false)
  })

  it('should handle file read errors gracefully', async () => {
    jest.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (dir === path.normalize('/home/user/.claude/rules')) {
        return [{ name: 'rule.md', isFile: () => true, isDirectory: () => false }] as any
      }
      return []
    })

    jest.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'))

    const result = await resolveRuleHierarchy({ claudePath: '/proj' })

    // Should still process but with default enabled=true
    expect(result[0]!.isGlobalEnabled).toBe(true)
  })
})
