# Service Specification — renderer-process

**Status:** Draft
**Date:** 2026-03-21
**Owner:** TBD
**System:** Claude Project Manager (CPM)
**Stack:** React 18 · TypeScript 5 · Vite 5 · Tailwind CSS · Cytoscape.js · Monaco Editor

---

## 1. Bounded Context

**Responsibility:** Owns the entire user interface. Renders the workspace browser, skill dependency graph, code editor, rules/hooks editor, MCP manager panel, agent configuration panel, backup history panel, and suggestion sidebar. Communicates with the main process exclusively via typed IPC channels through the `window.ipc` preload bridge. Has no direct filesystem, OS keychain, or Node.js access.

**Does not own:**
- Any filesystem I/O
- Any Claude API calls
- Business logic (graph resolution, backup management, dependency parsing)

---

## 2. UI Structure

```
App
├── WorkspaceBrowser          — left sidebar: project tree, .claude folder list
├── MainArea
│   ├── SkillGraphView        — Cytoscape.js interactive graph
│   │   ├── NodeInspector     — skill details on node select
│   │   └── GraphToolbar      — layout, zoom, filter controls
│   ├── SplitEditorView       — Monaco editor (raw) beside graph or preview
│   │   ├── MonacoEditor      — skill/rule/hook file editor
│   │   └── DiffViewer        — Monaco diff for orchestrator sync preview
│   ├── RulesHooksView        — rules and hooks list + editor
│   ├── MCPManagerView        — MCP marketplace + local MCP config
│   ├── AgentConfigView       — agent identity, prompts, bindings
│   └── BackupHistoryView     — per-file snapshot list + rollback
├── SuggestionSidebar         — AI suggestion cards (simplify, merge, fix)
├── CommandPalette            — Cmd+K quick action search
├── OnboardingWizard          — first-run API key entry + project setup
└── StatusBar                 — health indicator, git status, API key status
```

---

## 3. Hexagonal Layer Boundaries

The renderer has no domain or infrastructure layers — it is a pure presentation layer.

```
renderer-process
└── presentation/
    ├── components/    — React components (stateless where possible)
    ├── hooks/         — custom React hooks wrapping IPC calls
    ├── stores/        — Zustand stores for UI state (graph, editor, suggestions)
    ├── ipc/           — typed IPC client wrappers (calls window.ipc)
    └── styles/        — Tailwind config, theme tokens
```

State management: **Zustand** for global UI state (selected project, open file, graph data, suggestions). React Query for IPC calls that behave like data fetching (project list, file reads). Local component state for ephemeral UI state (panel open/close, hover).

---

## 4. IPC Calls Made

| Channel | When called | Response used for |
|---|---|---|
| `project:scan` | On app open + manual refresh | Populates workspace browser |
| `project:list` | On workspace browser mount | Initial project list |
| `project:create` | User clicks "New .claude" | Creates folder, refreshes list |
| `file:read` | User opens a skill/rule/hook | Populates Monaco editor |
| `file:write` | User saves (Ctrl+S / confirm) | Triggers graph refresh |
| `file:delete` | User confirms deletion | Removes from graph/list |
| `skill:parse-graph` | After `config:changed` event | Updates Cytoscape graph |
| `suggestion:request` | On project open / sidebar refresh | Populates suggestion cards |
| `backup:list` | User opens history panel | Shows snapshot list |
| `backup:rollback` | User confirms rollback | Replaces editor content |
| `git:status` | On project open | Shows Git badge in status bar |
| `git:commit` | User triggers commit | Confirms commit in UI |
| `skill:toggle` | User clicks enable/disable toggle | Updates graph node style; reloads graph |
| `rule:toggle` | User clicks enable/disable toggle | Updates rule list style |
| `hook:toggle` | User clicks enable/disable toggle | Updates hook list style |
| `mcp:list-local` | On MCP panel open | Shows installed MCPs |
| `mcp:install` | User selects from marketplace | Shows progress, confirms |
| `auth:validate` | On app startup | Shows/hides auth gate |

---

## 5. Key Components

### SkillGraphView
- Renders Cytoscape.js graph from `graph:updated` IPC event data
- Node colors: valid skill (blue), orchestrator (purple), broken reference (red), circular dep (orange), disabled (grey/muted)
- Toggle button on each node and in NodeInspector: enables/disables skill; calls `skill:toggle` IPC; disabled nodes and all their edges render muted
- On node click: opens file in SplitEditorView, shows NodeInspector
- On edge click: shows dependency details
- On drag-and-drop: emits file rename or dependency reorder intent → confirmed by user → `file:write`

### SplitEditorView
- Left pane: Monaco editor for raw `.md` file content
- Right pane: rendered Markdown preview OR MonacoDiffEditor for orchestrator sync preview
- On `orchestrator:sync-started`: switches right pane to DiffViewer showing old vs new content
- Save: Ctrl+S triggers `file:write` with current editor content

### BackupHistoryView
- Lists snapshots from `backup:list` response, sorted newest first
- Each entry shows: timestamp, file size delta, preview of first changed line
- Rollback button: shows confirmation dialog → calls `backup:rollback` → reloads editor

### OnboardingWizard
- Shown on first launch or when `auth:validate` returns invalid
- Input: API key or subscription token → calls `auth:validate` → stores via main process to OS keychain
- Step 2: workspace directory selection
- Step 3: optional — scan existing projects

### CommandPalette (Cmd+K)
- Fuzzy search over: skills, rules, hooks, projects, actions (new skill, new rule, etc.)
- Keyboard-navigable; opens file in editor or triggers action on Enter

### Rule Inheritance UI

#### RulesHooksView (UPDATED)
- Global rules now show a "Project supplement" badge when a same-slug project rule exists
- "Add supplement" action shown when no supplement exists
- When supplement exists: split layout with global rule read-only on left and supplement editable on right

#### SupplementEditorView (NEW)
- Monaco editor for project-level rule supplement
- Header shows "Supplementing: <global-rule-name>"
- Pre-populated with Additions/Overrides/Exclusions section scaffold

### CRUD Dialogs

#### CreateSkillDialog (NEW)
- Guided form: name field, description field, optional triggers (comma-separated), optional dependencies (comma-separated)
- Generates SKILL.md frontmatter + Purpose/Instructions/Constraints section scaffold
- On submit calls `skill:create`, then opens editor

#### CreateRuleDialog (NEW)
- Guided form: name field, description field, optional paths glob
- Generates rule frontmatter + Purpose/Rules section scaffold
- On submit calls `rule:create`, then opens editor

#### DeleteConfirmDialog (UPDATED)
- Shows "A backup snapshot will be created before deletion" note
- Confirm button calls `skill:delete` or `rule:delete`

### Section and Item Editing

#### SectionEditor (NEW)
- Wraps each `##` section block in the editor view
- Provides inline "Edit section" button (opens Monaco focused on section)
- "Delete section" button (disabled with lock icon for required sections)
- Drag handle for reordering non-required sections

#### ItemList (NEW)
- Used inside `## Instructions`, `## Constraints`, `## Rules`, `## Additions`, `## Overrides`, `## Exclusions` sections
- Renders:
  - Numbered sections: each item as "N. <content>" row with edit/delete/drag-reorder buttons
  - Bullet sections (Constraints): each item as "- <content>" row with edit/delete/drag-reorder buttons
  - "Add item" button at list bottom; "Insert above" on hover per row
  - Inline edit: click content → contenteditable; Enter confirms (calls `file:update-item`); Escape cancels
  - Drag-and-drop reorder → calls `file:reorder-item`; numbered sections auto-renumber
  - Deletion warns if the item is referenced in an Overrides supplement entry

#### AddSectionButton (NEW)
- Rendered between sections and at file end
- Dropdown of allowed section names for the current file type + "Custom section" option
- Calls `file:add-section`

---

## 6. State Stores (Zustand)

```typescript
// WorkspaceStore
interface WorkspaceStore {
  projects: ClaudeFolder[];
  selectedProject: ClaudeFolder | null;
  ruleHierarchy: RuleHierarchy[];  // populated by rule:get-hierarchy on project open
  selectProject: (project: ClaudeFolder) => void;
}

// EditorStore
interface EditorStore {
  openFilePath: string | null;
  content: string;
  isDirty: boolean;
  openFile: (path: string) => Promise<void>;
  saveFile: () => Promise<void>;
}

// GraphStore
interface GraphStore {
  elements: CytoscapeElements;   // nodes + edges from last graph:updated
  selectedNodeId: string | null;
  setElements: (elements: CytoscapeElements) => void;
}

// SuggestionStore
interface SuggestionStore {
  suggestions: Suggestion[];
  isLoading: boolean;
  setSuggestions: (s: Suggestion[]) => void;
}
```

---

## 7. Theme & Accessibility

- Dark and light themes via CSS custom properties; user preference persisted in `localStorage`
- Keyboard navigation for all interactive elements (graph nodes, palette, panels)
- ARIA labels on graph nodes and editor panels
- Focus trap in modal dialogs (rollback confirm, delete confirm)

---

## 8. Security

- `contextIsolation=true`, `nodeIntegration=false` — renderer cannot access Node.js APIs directly
- All IPC calls go through `window.ipc` preload bridge — no direct `ipcRenderer` usage in components
- No external URLs loaded in renderer; CSP header set by main process on window creation

---

## 9. Observability

- Console errors forwarded to main-process log via IPC `log:error` channel on unhandled promise rejections
- User-facing error toasts for IPC failures — never raw error messages (sanitized for display)

---

## 10. Error Handling

- IPC call failures: show toast notification with action (retry / dismiss); log at ERROR level via `log:error`
- Graph render errors: show error state in graph panel, allow manual refresh
- Editor save conflicts (file changed on disk since last read): show diff and ask user to resolve before save
- Orchestrator sync failure: show diff panel with error state; user can accept partial result or cancel
