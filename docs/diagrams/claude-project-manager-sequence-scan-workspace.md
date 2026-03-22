# Sequence Diagram — Scan Workspace

**Status:** Draft
**Date:** 2026-03-21
**Use case:** ScanWorkspaceUseCase — user opens CPM or triggers manual refresh; app discovers all `.claude/` folders and builds the initial dependency graph
**Depends on:** `docs/diagrams/claude-project-manager-class.md`

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Class diagram | `docs/diagrams/claude-project-manager-class.md` | Entity names, method signatures |
| Service spec (main-process) | `docs/architecture/service-main-process.md` | ScanWorkspaceUseCase, WatchFolderUseCase |
| Service spec (skill-graph-service) | `docs/architecture/service-skill-graph-service.md` | BuildGraphUseCase |
| Service spec (renderer-process) | `docs/architecture/service-renderer-process.md` | IPC call sequence |

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Renderer as Renderer Process<br/>(React UI)
    participant Main as Main Process<br/>(IPC Host)
    participant GraphSvc as skill-graph-service
    participant FS as Filesystem<br/>(.claude/ folders)

    User->>Renderer: Opens CPM / clicks Refresh

    Renderer->>Main: IPC project:scan (workspaceFolders[])
    activate Main

    loop For each WorkspaceFolder
        Main->>FS: Recursively find .claude/ directories
        FS-->>Main: string[] (claudePaths found)

        loop For each claudePath
            Main->>FS: Read directory listing (skills/, rules/, hooks/, mcp/)
            FS-->>Main: ClaudeFolderContents

            Main->>FS: Read each SKILL.md / RULE.md / HOOK.md
            FS-->>Main: FileEntry[] (path + content)

            Main->>GraphSvc: buildGraph(fileEntries: FileEntry[])
            activate GraphSvc
            GraphSvc->>GraphSvc: FrontmatterParser.parse() per file
            GraphSvc->>GraphSvc: BuildGraphUseCase — construct DependencyGraph
            GraphSvc->>GraphSvc: ValidateGraphUseCase — detect cycles, broken refs
            GraphSvc-->>Main: DependencyGraph
            deactivate GraphSvc

            Main->>GraphSvc: serializeForCytoscape(graph: DependencyGraph)
            GraphSvc-->>Main: CytoscapeElements

            Main-->>Renderer: IPC project:discovered (ClaudeFolder + CytoscapeElements)
        end
    end

    Renderer->>Renderer: WorkspaceStore.setProjects(claudeFolders[])
    Renderer->>Renderer: GraphStore.setElements(cytoscapeElements)
    Renderer-->>User: Workspace browser + skill graph rendered

    Main->>FS: chokidar.watch(claudePath) — start filesystem watcher
    note over Main,FS: WatchFolderUseCase started; emits config:changed on any file modification

    deactivate Main
```

---

## Alt Flows

```mermaid
sequenceDiagram
    autonumber
    participant Main as Main Process
    participant FS as Filesystem

    note over Main,FS: Alt: No .claude/ folder found
    Main->>FS: Scan workspace directories
    FS-->>Main: [] (empty)
    Main-->>Main: Emit project:discovered with empty list
    note over Main: Renderer shows "No .claude folders found — create one?"

    note over Main,FS: Alt: SKILL.md missing frontmatter
    Main->>FS: Read SKILL.md
    FS-->>Main: content (no --- block)
    Main->>Main: GraphSvc marks node isMissingFrontmatter=true
    note over Main: Node shown in graph with warning badge; scan continues
```

---

## Notes

- Scan is triggered on app open and on manual refresh; WatchFolderUseCase keeps graph live after initial scan
- `BuildGraphUseCase` must complete in < 100ms for up to 200 skill files (per service spec)
- File content is read by main-process and passed as strings to skill-graph-service (keeps graph service pure — no direct FS access)
- Auth validation (`auth:validate`) runs in parallel with scan on app open; scan result is held until auth gate passes
