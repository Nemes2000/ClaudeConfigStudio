import type { FileEntry } from '../../domain/models/file-entry'
import type {
  DependencyGraph,
  SkillNode,
  GraphValidation,
  BrokenRef,
  CytoscapeElements,
} from '../../domain/models/skill-node'
import { isOrchestrator } from '../../domain/models/skill-node'
import { extractSectionHeadings } from '../queries/validate-skill-structure-use-case'
import matter from 'gray-matter'
import * as path from 'path'

/**
 * Parses FileEntry[] into a DependencyGraph with validation.
 * Must complete in <100ms for up to 200 files.
 */
export function buildGraph(fileEntries: FileEntry[]): DependencyGraph {
  const nodes = new Map<string, SkillNode>()
  const edges = new Map<string, Set<string>>()
  const reverseEdges = new Map<string, Set<string>>()

  for (const entry of fileEntries) {
    if (!entry.exists || !entry.absolutePath.includes(`${path.sep}skills${path.sep}`)) {
      continue
    }
    const node = parseSkillNode(entry)
    nodes.set(node.slug, node)
    edges.set(node.slug, new Set(node.dependencies))
    for (const dep of node.dependencies) {
      if (!reverseEdges.has(dep)) reverseEdges.set(dep, new Set())
      reverseEdges.get(dep)!.add(node.slug)
    }
  }

  const validation = validateGraph(nodes, edges)
  return { nodes, edges, reverseEdges, validation }
}

function parseSkillNode(entry: FileEntry): SkillNode {
  if (!entry.content.includes('---')) {
    // No frontmatter
    const slug = extractSlugFromPath(entry.absolutePath)
    return {
      slug,
      name: slug,
      description: '',
      version: '',
      filePath: entry.absolutePath,
      isEnabled: true,
      dependencies: [],
      mcpServers: [],
      diagrams: [],
      triggers: [],
      isMissingFrontmatter: true,
      hasPurposeSection: false,
      hasInstructionsSection: false,
    }
  }

  const parsed = matter(entry.content)
  const data = parsed.data as Record<string, unknown>
  const slug = extractSlugFromPath(entry.absolutePath)
  const headings = extractSectionHeadings(entry.content)

  return {
    slug,
    name: String(data['name'] ?? slug),
    description: String(data['description'] ?? ''),
    version: String(data['version'] ?? ''),
    filePath: entry.absolutePath,
    isEnabled: data['enabled'] !== false,
    dependencies: toStringArray(data['dependencies']),
    mcpServers: toStringArray(data['mcp_servers']),
    diagrams: toStringArray(data['diagrams']),
    triggers: toStringArray(data['triggers']),
    isMissingFrontmatter: false,
    hasPurposeSection: headings.includes('Purpose'),
    hasInstructionsSection: headings.includes('Instructions'),
  }
}

function extractSlugFromPath(filePath: string): string {
  // skills/<slug>/SKILL.md → slug is the directory name
  const parts = filePath.split(path.sep)
  const skillIdx = parts.lastIndexOf('skills')
  if (skillIdx >= 0 && skillIdx + 1 < parts.length) {
    return parts[skillIdx + 1] ?? path.basename(path.dirname(filePath))
  }
  return path.basename(path.dirname(filePath))
}

function toStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  return []
}

function validateGraph(
  nodes: Map<string, SkillNode>,
  edges: Map<string, Set<string>>,
): GraphValidation {
  const brokenReferences: BrokenRef[] = []
  const missingFrontmatter: string[] = []
  const malformedStructure: string[] = []
  const unusedSlugs: string[] = []

  for (const [slug, node] of nodes.entries()) {
    if (node.isMissingFrontmatter) missingFrontmatter.push(slug)
    if (!node.hasPurposeSection || !node.hasInstructionsSection) {
      malformedStructure.push(slug)
    }
    const deps = edges.get(slug)
    if (deps) {
      for (const dep of deps) {
        if (!nodes.has(dep)) {
          brokenReferences.push({ fromSlug: slug, toSlug: dep })
        }
      }
    }
  }

  // Unused: a node is never referenced as a dependency by any other node
  const allDeps = new Set([...edges.values()].flatMap((s) => [...s]))
  for (const slug of nodes.keys()) {
    if (!allDeps.has(slug)) unusedSlugs.push(slug)
  }

  const cycles = detectCycles(nodes, edges)

  return { cycles, brokenReferences, unusedSlugs, missingFrontmatter, malformedStructure }
}

function detectCycles(
  nodes: Map<string, SkillNode>,
  edges: Map<string, Set<string>>,
): string[][] {
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const cycles: string[][] = []

  function dfs(slug: string, stack: string[]): void {
    visited.add(slug)
    inStack.add(slug)
    stack.push(slug)

    for (const dep of edges.get(slug) ?? []) {
      if (!visited.has(dep)) {
        dfs(dep, stack)
      } else if (inStack.has(dep)) {
        const cycleStart = stack.indexOf(dep)
        cycles.push(stack.slice(cycleStart))
      }
    }

    stack.pop()
    inStack.delete(slug)
  }

  for (const slug of nodes.keys()) {
    if (!visited.has(slug)) dfs(slug, [])
  }

  return cycles
}

export function findOrchestrators(
  modifiedSlug: string,
  graph: DependencyGraph,
): SkillNode[] {
  const results: SkillNode[] = []
  const seen = new Set<string>()
  const queue = [modifiedSlug]

  while (queue.length > 0) {
    const current = queue.shift()!
    const parents = graph.reverseEdges.get(current)
    if (!parents) continue
    for (const parentSlug of parents) {
      if (seen.has(parentSlug)) continue
      seen.add(parentSlug)
      const node = graph.nodes.get(parentSlug)
      if (node && isOrchestrator(node)) {
        results.push(node)
        queue.push(parentSlug)
      }
    }
  }

  return results
}

export function serializeForCytoscape(graph: DependencyGraph): CytoscapeElements {
  const nodes = [...graph.nodes.values()].map((node) => ({
    data: {
      id: node.slug,
      label: node.name || node.slug,
      isEnabled: node.isEnabled,
      isMissingFrontmatter: node.isMissingFrontmatter,
      isOrchestrator: isOrchestrator(node),
    },
  }))

  const brokenSlugs = new Set(
    graph.validation.brokenReferences.map((r) => `${r.fromSlug}→${r.toSlug}`),
  )

  const edges: CytoscapeElements['edges'] = []
  for (const [fromSlug, deps] of graph.edges.entries()) {
    for (const toSlug of deps) {
      edges.push({
        data: {
          id: `${fromSlug}->${toSlug}`,
          source: fromSlug,
          target: toSlug,
          isBroken: brokenSlugs.has(`${fromSlug}→${toSlug}`),
        },
      })
    }
  }

  return { nodes, edges }
}
