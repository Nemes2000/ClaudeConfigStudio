# Event Specification — graph:updated

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Delivers rebuilt dependency graph in Cytoscape-ready format after every `config:changed`. Renderer updates SkillGraphView without additional IPC round-trips.

## Producer
`main-process` — emitted after `skill-graph-service.BuildGraphUseCase` + `SerializeForCytoscapeUseCase` complete. One event per `config:changed`.

## Consumers
| Consumer | Reaction |
|---|---|
| GraphStore | Replace `elements`; trigger Cytoscape re-render |
| SkillGraphView | Re-render nodes/edges with updated styles |
| SuggestionSidebar | Highlight nodes with validation errors |

## Payload Schema
```typescript
interface GraphUpdatedPayload {
  claudePath: string;
  elements: { nodes: CyNode[]; edges: CyEdge[] };
  validation: {
    cycles: string[][];
    brokenReferences: Array<{ fromSlug: string; toSlug: string }>;
    unusedSlugs: string[];
    missingFrontmatter: string[];
    malformedStructure: string[];  // slugs missing required sections (ADR 0010)
  };
  buildDurationMs: number;
}

interface CyNode {
  data: {
    id: string; label: string; description: string;
    isEnabled: boolean; isMissingFrontmatter: boolean;
    hasError: boolean; mcpServers: string[]; filePath: string;
  };
}

interface CyEdge {
  data: { id: string; source: string; target: string; isBroken: boolean; };
}
```

## Rules
- `buildDurationMs` must be < 100ms for ≤ 200 skill files (SLA from service spec)
- Disabled nodes included with `isEnabled=false`; renderer applies 35% opacity class
- `GraphStore.setElements()` is a full replacement — safe on duplicate events
- `hasError=true` on all nodes participating in a detected cycle
- `malformedStructure` lists slugs where required `## Purpose` or `## Instructions`/`## Rules` sections are absent
