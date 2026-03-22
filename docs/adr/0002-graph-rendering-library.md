# 0002 — Use Cytoscape.js for skill dependency graph rendering

**Status:** Proposed

**Date:** 2026-03-21

## Context

CPM must render an interactive dependency graph where nodes are skill files and edges represent references parsed from file content. Users must be able to drag-and-drop nodes, edit connections, select skills to open them, and see validation highlights (circular dependencies, unused skills). The graph library must work within a React component in the Electron renderer process.

## Decision

We will use Cytoscape.js because it is purpose-built for network/graph visualization with first-class support for interactive node manipulation, layout algorithms suited to dependency trees, and a well-maintained React wrapper (`react-cytoscapejs`). Its event model maps cleanly to our IPC-driven update loop.

## Alternatives Considered

### D3.js
D3 is extremely powerful and flexible but operates at a low level — building a fully interactive graph editor (drag, connect, select, highlight cycles) requires substantial custom code for hit-testing, edge routing, zoom/pan, and layout. Cytoscape.js provides all of these out of the box. D3 would be appropriate if we needed custom rendering not achievable with Cytoscape's built-in styles, which is not the case here.

### React Flow
React Flow is a strong alternative with a React-native API and built-in node/edge editing. It is optimized for flow/pipeline diagrams (left-to-right DAGs) rather than general network graphs. Cytoscape.js supports a wider range of layout algorithms (cose, breadthfirst, circle) better suited to the irregular shape of skill dependency graphs, and has more mature cycle-detection and traversal APIs useful for dependency validation.

### vis.js (vis-network)
vis-network supports interactive graph editing but has had inconsistent maintenance, a large bundle size, and less idiomatic React integration than Cytoscape.js.

## Consequences

**Positive:**
- Built-in layout algorithms (cose, dagre via extension) handle irregular skill graphs without custom layout code
- Rich event model (tap, drag, select, mouseover) maps directly to skill editing interactions
- Graph traversal and cycle-detection APIs usable directly for dependency validation
- `react-cytoscapejs` wrapper provides idiomatic React integration

**Negative / trade-offs:**
- Cytoscape.js has a steeper learning curve than React Flow for developers familiar with React-native component models
- Styling uses a CSS-like but Cytoscape-specific syntax — not standard CSS or Tailwind
- Bundle size (~300 KB minified) is larger than React Flow for simple use cases

**Neutral:**
- Layout algorithm extensions (dagre, cola) must be installed separately
- Graph state lives outside React state — must be synced explicitly on IPC `graph:updated` events

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
