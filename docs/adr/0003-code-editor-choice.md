# 0003 — Use Monaco Editor for the embedded code editor

**Status:** Proposed

**Date:** 2026-03-21

## Context

CPM requires an embedded code editor for viewing and editing skill `.md` files, rule files, hook scripts, and MCP config files (YAML/JSON). The editor must support syntax highlighting for Markdown, YAML, JSON, and shell scripts; display a split view (raw code beside the graph); and eventually support inline diff display when showing pre/post changes from the orchestrator sync.

## Decision

We will use Monaco Editor (via `@monaco-editor/react`) because it provides production-grade syntax highlighting for all required file types, built-in diff editor support needed for orchestrator sync previews, and is the same editor underlying VS Code — familiar to the target user base of developers.

## Alternatives Considered

### CodeMirror 6
CodeMirror 6 is modular, lightweight, and has excellent language support via the `@codemirror/lang-*` packages. Its bundle size is significantly smaller than Monaco (~50 KB vs ~2 MB). However, implementing a side-by-side diff view (needed for orchestrator sync preview) requires custom work in CodeMirror, while Monaco provides `MonacoDiffEditor` out of the box. Given that diff preview is a first-class feature of orchestrator sync, Monaco's built-in diff editor is a decisive advantage.

### Ace Editor
Ace is mature but its development has slowed significantly. Monaco and CodeMirror 6 both offer better TypeScript support, more active maintenance, and better language server protocol integration for future extensibility.

### Plain `<textarea>` with highlight.js
Sufficient for read-only display but provides no editing capability, no inline diff, and no language-aware features. Rejected as it cannot meet the editing requirements.

## Consequences

**Positive:**
- Built-in `MonacoDiffEditor` directly supports orchestrator sync before/after preview
- Syntax highlighting for Markdown, YAML, JSON, Bash out of the box
- Familiar VS Code keybindings for the target developer audience
- Good TypeScript support for integrating editor state with React

**Negative / trade-offs:**
- Monaco bundle is large (~2 MB minified); requires worker configuration in Vite/Webpack to avoid blocking the main thread
- Monaco assumes a browser-like environment — worker setup in Electron requires explicit configuration (`monaco-editor-webpack-plugin` or Vite equivalent)
- Heavier memory footprint than CodeMirror 6 for simple editing tasks

**Neutral:**
- `@monaco-editor/react` wrapper handles React lifecycle integration
- Language server protocol support available for future extensibility (e.g. YAML schema validation)

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
