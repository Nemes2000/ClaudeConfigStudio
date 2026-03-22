import { toggleSkillNode, isOrchestrator, hasErrors, hasCycles } from '../../../src/main/domain/models/skill-node'
import type { SkillNode, GraphValidation } from '../../../src/main/domain/models/skill-node'

const makeNode = (overrides: Partial<SkillNode> = {}): SkillNode => ({
  slug: 'test-skill',
  name: 'Test Skill',
  description: 'A test skill',
  version: '1.0.0',
  filePath: '/home/user/.claude/skills/test-skill/SKILL.md',
  isEnabled: true,
  dependencies: [],
  mcpServers: [],
  diagrams: [],
  triggers: [],
  isMissingFrontmatter: false,
  hasPurposeSection: true,
  hasInstructionsSection: true,
  ...overrides,
})

describe('SkillNode', () => {
  describe('toggleSkillNode', () => {
    it('disables an enabled node', () => {
      const node = makeNode({ isEnabled: true })
      const result = toggleSkillNode(node, false)
      expect(result.isEnabled).toBe(false)
    })

    it('enables a disabled node', () => {
      const node = makeNode({ isEnabled: false })
      const result = toggleSkillNode(node, true)
      expect(result.isEnabled).toBe(true)
    })

    it('returns a new object (immutable)', () => {
      const node = makeNode()
      const result = toggleSkillNode(node, false)
      expect(result).not.toBe(node)
    })
  })

  describe('isOrchestrator', () => {
    it('returns true when node has dependencies', () => {
      const node = makeNode({ dependencies: ['dep-a', 'dep-b'] })
      expect(isOrchestrator(node)).toBe(true)
    })

    it('returns false when node has no dependencies', () => {
      const node = makeNode({ dependencies: [] })
      expect(isOrchestrator(node)).toBe(false)
    })
  })
})

describe('GraphValidation', () => {
  const clean: GraphValidation = {
    cycles: [],
    brokenReferences: [],
    unusedSlugs: [],
    missingFrontmatter: [],
    malformedStructure: [],
  }

  describe('hasErrors', () => {
    it('returns false for clean graph', () => {
      expect(hasErrors(clean)).toBe(false)
    })

    it('returns true when cycles present', () => {
      expect(hasErrors({ ...clean, cycles: [['a', 'b']] })).toBe(true)
    })

    it('returns true when broken refs present', () => {
      expect(hasErrors({ ...clean, brokenReferences: [{ fromSlug: 'a', toSlug: 'b' }] })).toBe(true)
    })

    it('returns true when missing frontmatter', () => {
      expect(hasErrors({ ...clean, missingFrontmatter: ['x'] })).toBe(true)
    })
  })

  describe('hasCycles', () => {
    it('returns false with no cycles', () => {
      expect(hasCycles(clean)).toBe(false)
    })

    it('returns true with cycles', () => {
      expect(hasCycles({ ...clean, cycles: [['a', 'b', 'a']] })).toBe(true)
    })
  })
})
