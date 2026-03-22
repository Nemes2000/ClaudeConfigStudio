# Service Specification — skill-graph-service

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · TypeScript 5 · gray-matter · in-process module

---

## 1. Bounded Context

**Responsibility:** Parses skill and rule files to extract YAML frontmatter metadata, builds the in-memory dependency graph for a `.claude/` project, validates graph integrity (cycles, broken references, unused skills), and identifies orchestrator skills affected when a given skill is modified. Runs entirely in the main process as an in-process module — no network calls.

**Does not own:**
- Filesystem I/O (reads files via main-process `file:read` use case)
- AI calls for orchestrator rewriting (ai-suggestion-service)
- UI rendering of the graph (renderer-process / Cytoscape.js)

---

## 2. Responsibilities

- Parse YAML frontmatter from skill and rule `.md` files using `gray-matter`
- Build a directed dependency graph: nodes = skill slugs, edges = `dependencies` frontmatter entries
- Validate graph: detect cycles, broken references (dependency listed but no matching file), and unused skills (no incoming edges, not an orchestrator)
- Identify orchestrators: skills whose `dependencies` list includes a given modified skill slug
- Serialize graph to a Cytoscape-compatible element format for IPC delivery to renderer
- Re-parse graph on every `config:changed` event from main-process

---

## 3. Hexagonal Layer Boundaries

```
skill-graph-service (in-process module)
├── domain/
│   ├── SkillNode           — value object: slug, name, description, deps, mcpServers, diagrams, triggers
│   ├── DependencyGraph     — aggregate: nodes map + adjacency list + validation results
│   └── GraphValidation     — value object: cycles[], brokenRefs[], unusedSlugs[], missingFrontmatter[]
├── application/
│   ├── BuildGraphUseCase   — reads all skill files, parses frontmatter, constructs DependencyGraph
│   ├── ValidateGraphUseCase — runs cycle detection + ref validation on a DependencyGraph
│   └── FindOrchestratorsUseCase — given modified slug, returns all slugs whose deps include it
└── infrastructure/
    └── FrontmatterParser   — wraps gray-matter; maps raw YAML to SkillNode value object
```

---

## 4. Domain Models

```typescript
interface SkillNode {
  slug: string;                 // directory name — unique ID
  name: string;                 // from frontmatter name field
  description: string;          // from frontmatter description field
  version: string;              // semver, default "1.0.0"
  filePath: string;             // absolute path to SKILL.md on disk
  isEnabled: boolean;           // false if frontmatter contains enabled: false
  dependencies: string[];       // slugs of skills this skill depends on
  mcpServers: string[];         // MCP server names required
  diagrams: string[];           // relative diagram file paths
  triggers: string[];           // activation phrase patterns
  isMissingFrontmatter: boolean; // true if file has no --- block
  hasPurposeSection: boolean;   // true if body contains `## Purpose` heading
  hasInstructionsSection: boolean; // true if body contains `## Instructions` heading
}

interface DependencyGraph {
  nodes: Map<string, SkillNode>;       // slug → SkillNode
  edges: Map<string, Set<string>>;     // slug → set of dependency slugs
  reverseEdges: Map<string, Set<string>>; // slug → set of slugs that depend on it
  validation: GraphValidation;
}

interface GraphValidation {
  cycles: string[][];           // each inner array is one cycle path
  brokenReferences: BrokenRef[];
  unusedSlugs: string[];        // skills with no incoming edges and not listed as orchestrators
  missingFrontmatter: string[]; // file paths lacking frontmatter
  malformedStructure: string[]; // skill slugs missing required sections (Purpose, Instructions)
}

interface BrokenRef {
  fromSlug: string;
  toSlug: string;               // referenced slug that has no matching file
}
```

---

## 5. Key Use Cases

### BuildGraphUseCase
- Input: list of skill file paths for a `.claude/` project
- Action:
  1. Read each file content (via main-process file read — passed in as pre-read strings to keep this module pure)
  2. Parse frontmatter with `FrontmatterParser`
  3. After frontmatter parse, scan body for `## Purpose` and `## Instructions` headings (regex `/^## Purpose/m` and `/^## Instructions/m`); populate `hasPurposeSection` and `hasInstructionsSection`
  4. Construct `DependencyGraph` from parsed nodes
  5. Run `ValidateGraphUseCase`
- Output: `DependencyGraph`
- Performance: must complete in < 100ms for up to 200 skill files

### ValidateGraphUseCase
- Input: `DependencyGraph`
- Action:
  - Cycle detection: depth-first search with visited/recursion-stack tracking
  - Broken reference detection: for each edge, check if target slug exists in nodes map
  - Unused detection: nodes with empty `reverseEdges` entry and not matching known orchestrator patterns
  - Structure validation: skills with `hasPurposeSection: false` or `hasInstructionsSection: false` are added to `GraphValidation.malformedStructure[]`
- Output: `GraphValidation` (mutates `graph.validation` in place)

### FindOrchestratorsUseCase
- Input: modified skill slug + `DependencyGraph`
- Action: traverse `reverseEdges` recursively to find all transitive dependents
- Output: `SkillNode[]` — the orchestrators whose content must be updated by ai-suggestion-service
- Note: direct dependents only for first pass; full transitive closure for deep orchestrator chains

**Orchestrator definition — `SkillNode.isOrchestrator()`:**
A skill is an orchestrator if and only if `reverseEdges.get(slug)?.size > 0` — i.e., at least one other enabled skill declares it as a dependency. There is no explicit `is_orchestrator` flag in frontmatter. The relationship is derived purely from the graph. A skill with no incoming edges is a leaf node; a skill with one or more incoming edges is an orchestrator for those dependents.

```typescript
// Implementation in SkillNode value object
isOrchestrator(): boolean {
  // Caller must pass the reverseEdges map from the owning DependencyGraph
  return (reverseEdgesMap.get(this.slug)?.size ?? 0) > 0;
}
```

**Unused detection rule (in `ValidateGraphUseCase`):**
A skill is "unused" if: `reverseEdges.get(slug)?.size === 0` (no dependents) AND `dependencies.length === 0` (no declared dependencies). Pure leaf skills with no connections either way are flagged as unused. Orchestrators (skills with dependents) are never flagged as unused regardless of their own dependency list.

### SerializeForCytoscapeUseCase
- Input: `DependencyGraph`
- Output: `{ nodes: CyNode[], edges: CyEdge[] }` — Cytoscape element format
- Node data: `{ id, label, description, hasError, isMissingFrontmatter, mcpServers, isEnabled }`
- Disabled nodes rendered with `opacity: 0.35` class in Cytoscape styles; edges from/to disabled nodes also dimmed
- Edge data: `{ id, source, target, isBroken }`

---

## 6. FrontmatterParser

Wraps `gray-matter`. Maps raw YAML to `SkillNode`:

```typescript
// filePath is the SKILL.md path; slug is derived from the parent directory name
// e.g. .claude/skills/spec-service/SKILL.md → slug: "spec-service"
function parseFrontmatter(filePath: string, content: string): SkillNode {
  const { data, content: body } = matter(content);
  return {
    slug: path.basename(path.dirname(filePath)), // directory name = slug
    isEnabled: data.enabled !== false,           // absent or true → enabled; false → disabled
    name: data.name ?? path.basename(filePath, '.md'),
    description: data.description ?? '',
    version: data.version ?? '1.0.0',
    filePath,
    dependencies: data.dependencies ?? [],
    mcpServers: data.mcp_servers ?? [],
    diagrams: data.diagrams ?? [],
    triggers: data.triggers ?? [],
    isMissingFrontmatter: !content.startsWith('---'),
  };
}
```

---

## 7. IPC Channels Served

| Channel | Caller | Response |
|---|---|---|
| `skill:parse-graph` | main-process (on `config:changed`) | Cytoscape element format |
| `skill:find-orchestrators` | ai-suggestion-service | `SkillNode[]` |
| `skill:validate` | renderer (on demand) | `GraphValidation` |

---

## 8. Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| gray-matter | npm | YAML frontmatter parsing |
| main-process | internal | File content delivery (pre-read strings) |

No network calls. No filesystem access directly — all file content passed in by main-process.

---

## 9. Observability

- Log `BuildGraphUseCase` duration at DEBUG level: `{ component: "skill-graph-service", durationMs, nodeCount, edgeCount }`
- Log validation results at INFO if any cycles or broken refs detected
- Log `FindOrchestratorsUseCase` results at DEBUG: `{ modifiedSlug, orchestratorsFound: string[] }`

---

## 10. Error Handling

- YAML parse error in frontmatter: mark node as `isMissingFrontmatter: true`, add file path to `GraphValidation.missingFrontmatter[]`, log WARN, continue building rest of graph
- Empty skills directory: return empty `DependencyGraph` with no validation errors
- Cycle detected: include in `GraphValidation.cycles` — does not throw; renderer displays cycle visually
