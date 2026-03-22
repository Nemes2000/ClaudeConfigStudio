import {
  hasSupplement,
  isFullyDisabled,
  type RuleHierarchy,
} from '../../../src/main/domain/models/rule-hierarchy'
import * as path from 'path'

describe('hasSupplement', () => {
  it('returns true when supplementPath is not null', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: true,
      isSupplementEnabled: true,
    }

    expect(hasSupplement(rule)).toBe(true)
  })

  it('returns false when supplementPath is null', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: '/home/user/.claude/rules/coding-rules.md',
      supplementPath: null,
      isGlobalEnabled: true,
      isSupplementEnabled: null,
    }

    expect(hasSupplement(rule)).toBe(false)
  })

  it('returns true even when supplement is disabled', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: true,
      isSupplementEnabled: false,
    }

    expect(hasSupplement(rule)).toBe(true)
  })
})

describe('isFullyDisabled', () => {
  it('returns true when global is disabled', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: '/home/user/.claude/rules/coding-rules.md',
      supplementPath: null,
      isGlobalEnabled: false,
      isSupplementEnabled: null,
    }

    expect(isFullyDisabled(rule)).toBe(true)
  })

  it('returns true when global is disabled even if supplement is enabled', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: false,
      isSupplementEnabled: true,
    }

    expect(isFullyDisabled(rule)).toBe(true)
  })

  it('returns true when supplement is explicitly disabled', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: true,
      isSupplementEnabled: false,
    }

    expect(isFullyDisabled(rule)).toBe(true)
  })

  it('returns false when both global and supplement are enabled', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: true,
      isSupplementEnabled: true,
    }

    expect(isFullyDisabled(rule)).toBe(false)
  })

  it('returns false when global is enabled and no supplement', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: '/home/user/.claude/rules/coding-rules.md',
      supplementPath: null,
      isGlobalEnabled: true,
      isSupplementEnabled: null,
    }

    expect(isFullyDisabled(rule)).toBe(false)
  })

  it('returns false when global is enabled and supplement is null (not disabled)', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: true,
      isSupplementEnabled: null,
    }

    expect(isFullyDisabled(rule)).toBe(false)
  })

  it('returns true when global is disabled regardless of supplement', () => {
    const rule: RuleHierarchy = {
      slug: 'coding-rules',
      globalPath: path.normalize('/home/user/.claude/rules/coding-rules.md'),
      supplementPath: path.normalize('/home/user/project/.claude/rules/coding-rules.md'),
      isGlobalEnabled: false,
      isSupplementEnabled: null,
    }

    expect(isFullyDisabled(rule)).toBe(true)
  })
})
