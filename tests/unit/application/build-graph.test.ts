import { buildGraph, findOrchestrators, serializeForCytoscape } from '../../../src/main/application/commands/build-graph-use-case'
import type { FileEntry } from '../../../src/main/domain/models/file-entry'

const makeEntry = (slug: string, overrides: Partial<FileEntry> & { dependencies?: string[] } = {}): FileEntry => {
  const { dependencies = [], ...rest } = overrides
  const depYaml = dependencies.length > 0
    ? `dependencies:\n${dependencies.map((d) => `  - ${d}`).join('\n')}`
    : ''
  return {
    absolutePath: `/home/.claude/skills/${slug}/SKILL.md`,
    relativePath: `skills/${slug}/SKILL.md`,
    exists: true,
    content: `---\nname: ${slug}\ndescription: Test\nversion: 1.0.0\n${depYaml}\n---\n\n## Purpose\n\nTest.\n\n## Instructions\n\n1. Do things.\n`,
    ...rest,
  }
}

describe('buildGraph', () => {
  it('builds an empty graph from empty input', () => {
    const graph = buildGraph([])
    expect(graph.nodes.size).toBe(0)
    expect(graph.validation.cycles).toHaveLength(0)
  })

  it('parses a single skill node', () => {
    const graph = buildGraph([makeEntry('my-skill')])
    expect(graph.nodes.has('my-skill')).toBe(true)
    expect(graph.nodes.get('my-skill')?.name).toBe('my-skill')
  })

  it('marks nodes without frontmatter as isMissingFrontmatter', () => {
    const entry: FileEntry = {
      absolutePath: '/home/.claude/skills/bare/SKILL.md',
      relativePath: 'skills/bare/SKILL.md',
      exists: true,
      content: '# Just a heading\n\nNo frontmatter here.',
    }
    const graph = buildGraph([entry])
    expect(graph.nodes.get('bare')?.isMissingFrontmatter).toBe(true)
  })

  it('detects broken references', () => {
    const graph = buildGraph([makeEntry('orchestrator', { dependencies: ['missing-dep'] })])
    expect(graph.validation.brokenReferences).toHaveLength(1)
    expect(graph.validation.brokenReferences[0]?.toSlug).toBe('missing-dep')
  })

  it('detects cycles', () => {
    const entries = [
      makeEntry('a', { dependencies: ['b'] }),
      makeEntry('b', { dependencies: ['a'] }),
    ]
    const graph = buildGraph(entries)
    expect(graph.validation.cycles).toHaveLength(1)
  })

  it('builds reverse edges correctly', () => {
    const entries = [
      makeEntry('leaf'),
      makeEntry('orchestrator', { dependencies: ['leaf'] }),
    ]
    const graph = buildGraph(entries)
    expect(graph.reverseEdges.get('leaf')?.has('orchestrator')).toBe(true)
  })
})

describe('findOrchestrators', () => {
  it('returns orchestrators that depend on the modified skill', () => {
    const entries = [
      makeEntry('leaf'),
      makeEntry('orch', { dependencies: ['leaf'] }),
    ]
    const graph = buildGraph(entries)
    const orchestrators = findOrchestrators('leaf', graph)
    expect(orchestrators.map((n) => n.slug)).toContain('orch')
  })

  it('returns empty array for leaf skill with no reverse edges', () => {
    const graph = buildGraph([makeEntry('leaf')])
    expect(findOrchestrators('leaf', graph)).toHaveLength(0)
  })
})

describe('serializeForCytoscape', () => {
  it('serializes nodes and edges', () => {
    const entries = [makeEntry('a'), makeEntry('b', { dependencies: ['a'] })]
    const graph = buildGraph(entries)
    const cyto = serializeForCytoscape(graph)
    expect(cyto.nodes).toHaveLength(2)
    expect(cyto.edges).toHaveLength(1)
    expect(cyto.edges[0]?.data.source).toBe('b')
    expect(cyto.edges[0]?.data.target).toBe('a')
  })
})
