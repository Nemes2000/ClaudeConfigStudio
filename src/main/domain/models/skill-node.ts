export type SuggestionType =
  | 'simplify'
  | 'merge-candidate'
  | 'unused-dependency'
  | 'missing-description'
  | 'improve-triggers'
  | 'missing-section'

export type SuggestionSeverity = 'info' | 'warning' | 'error'

export interface SkillNode {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly filePath: string
  readonly isEnabled: boolean
  readonly dependencies: readonly string[]
  readonly mcpServers: readonly string[]
  readonly diagrams: readonly string[]
  readonly triggers: readonly string[]
  readonly isMissingFrontmatter: boolean
  readonly hasPurposeSection: boolean
  readonly hasInstructionsSection: boolean
}

export function toggleSkillNode(node: SkillNode, enabled: boolean): SkillNode {
  return { ...node, isEnabled: enabled }
}

export function isOrchestrator(node: SkillNode): boolean {
  return node.dependencies.length > 0
}

export interface BrokenRef {
  readonly fromSlug: string
  readonly toSlug: string
}

export interface GraphValidation {
  readonly cycles: readonly (readonly string[])[]
  readonly brokenReferences: readonly BrokenRef[]
  readonly unusedSlugs: readonly string[]
  readonly missingFrontmatter: readonly string[]
  readonly malformedStructure: readonly string[]
}

export function hasErrors(validation: GraphValidation): boolean {
  return (
    validation.cycles.length > 0 ||
    validation.brokenReferences.length > 0 ||
    validation.missingFrontmatter.length > 0 ||
    validation.malformedStructure.length > 0
  )
}

export function hasCycles(validation: GraphValidation): boolean {
  return validation.cycles.length > 0
}

/** CytoscapeJS serialization types */
export interface CytoscapeNode {
  data: {
    id: string
    label: string
    isEnabled: boolean
    isMissingFrontmatter: boolean
    isOrchestrator: boolean
  }
}

export interface CytoscapeEdge {
  data: { id: string; source: string; target: string; isBroken: boolean }
}

export interface CytoscapeElements {
  nodes: CytoscapeNode[]
  edges: CytoscapeEdge[]
}

export interface DependencyGraph {
  readonly nodes: ReadonlyMap<string, SkillNode>
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>
  readonly reverseEdges: ReadonlyMap<string, ReadonlySet<string>>
  readonly validation: GraphValidation
}
