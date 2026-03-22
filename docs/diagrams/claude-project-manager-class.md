# Class Diagram — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**Service:** claude-project-manager
**Bounded context:** ProjectDiscovery · SkillManagement · OrchestratorSync · BackupAndRestore · MCPManagement · AIAssistance

---

## Specs Read

| Spec | File | Used for |
|---|---|---|
| Service spec (main-process) | `docs/architecture/service-main-process.md` | WorkspaceFolder, ClaudeFolder, ClaudeFolderContents, use cases |
| Service spec (skill-graph-service) | `docs/architecture/service-skill-graph-service.md` | SkillNode, DependencyGraph, GraphValidation, BrokenRef |
| Service spec (ai-suggestion-service) | `docs/architecture/service-ai-suggestion-service.md` | Suggestion, OrchestratorUpdate, AuthState |
| Service spec (backup-service) | `docs/architecture/service-backup-service.md` | Snapshot, BackupPolicy |
| Service spec (mcp-manager) | `docs/architecture/service-mcp-manager.md` | McpModule, McpInstallation, CompatibilityResult |
| Service spec (renderer-process) | `docs/architecture/service-renderer-process.md` | Presentation layer only — no domain classes |
| System spec | `docs/architecture/system-claude-project-manager.md` | Bounded context boundaries, IPC event topology |
| ADR 0008 | `docs/adr/0008-skill-rule-file-format.md` | Frontmatter schema → SkillNode fields |
| Event specs | `docs/events/*-spec.md` (6 specs) | DomainEvent classification; push payload field verification |
| API spec | `docs/api/ipc-channels-api.md` | IPC channel ownership verification per module |
| Resilience spec | `docs/architecture/resilience-claude-project-manager.md` | CircuitBreakerState enum; timeout values |

---

## Domain Model

```mermaid
classDiagram

    %% ─────────────────────────────────────────
    %% BOUNDED CONTEXT: ProjectDiscovery (main-process)
    %% ─────────────────────────────────────────

    class ClaudeFolder {
        <<AggregateRoot>>
        +string projectPath
        +string claudePath
        +boolean isRootLevel
        +ClaudeFolderContents contents
        +scan() ClaudeFolderContents
        +watch() void
        +createFromTemplate(templateName: string) void
    }

    class ClaudeFolderContents {
        <<ValueObject>>
        +string[] skills
        +string[] rules
        +string[] hooks
        +string[] mcps
        +string agentConfig
        +isEmpty() boolean
    }

    class WorkspaceFolder {
        <<ValueObject>>
        +string path
        +string label
        +isValid() boolean
    }

    class FileEntry {
        <<ValueObject>>
        +string absolutePath
        +string relativePath
        +string content
        +boolean exists
    }

    %% ─────────────────────────────────────────
    %% BOUNDED CONTEXT: SkillManagement (skill-graph-service)
    %% ─────────────────────────────────────────

    class DependencyGraph {
        <<AggregateRoot>>
        +Map~string_SkillNode~ nodes
        +Map~string_Set~ edges
        +Map~string_Set~ reverseEdges
        +GraphValidation validation
        +buildFrom(skillFiles: FileEntry[]) void
        +findOrchestrators(modifiedSlug: string) SkillNode[]
        +serializeForCytoscape() CytoscapeElements
        +validate() GraphValidation
    }

    class SkillNode {
        <<ValueObject>>
        +string slug
        +string name
        +string description
        +string version
        +string filePath
        +boolean isEnabled
        +string[] dependencies
        +string[] mcpServers
        +string[] diagrams
        +string[] triggers
        +boolean isMissingFrontmatter
        +boolean hasPurposeSection
        +boolean hasInstructionsSection
        +toggle(enabled: boolean) SkillNode
        +isOrchestrator() boolean
    }

    class GraphValidation {
        <<ValueObject>>
        +string[][] cycles
        +BrokenRef[] brokenReferences
        +string[] unusedSlugs
        +string[] missingFrontmatter
        +string[] malformedStructure
        +hasErrors() boolean
        +hasCycles() boolean
    }

    class BrokenRef {
        <<ValueObject>>
        +string fromSlug
        +string toSlug
    }

    %% ─────────────────────────────────────────
    %% BOUNDED CONTEXT: AIAssistance + OrchestratorSync (ai-suggestion-service)
    %% ─────────────────────────────────────────

    class AuthState {
        <<ValueObject>>
        +boolean isValid
        +boolean keyPresent
        +Date lastValidatedAt
        +isExpired() boolean
    }

    class Suggestion {
        <<ValueObject>>
        +SuggestionType type
        +string title
        +string description
        +string affectedSlug
        +SuggestionSeverity severity
        +string affectedSection
    }

    class OrchestratorUpdate {
        <<ValueObject>>
        +string orchestratorPath
        +string oldContent
        +string newContent
        +boolean isPartial
        +hasDiff() boolean
    }

    class SuggestionType {
        <<enumeration>>
        simplify
        merge-candidate
        unused-dependency
        missing-description
        improve-triggers
        missing-section
    }

    class SuggestionSeverity {
        <<enumeration>>
        info
        warning
        error
    }

    class CircuitBreakerState {
        <<enumeration>>
        CLOSED
        OPEN
        HALF_OPEN
    }

    %% ─────────────────────────────────────────
    %% BOUNDED CONTEXT: RuleInheritance (main-process)
    %% ─────────────────────────────────────────

    class RuleHierarchy {
        <<ValueObject>>
        +string slug
        +string globalPath
        +string supplementPath
        +boolean isGlobalEnabled
        +boolean|null isSupplementEnabled
        +hasSuplement() boolean
        +isFullyDisabled() boolean
    }

    %% ─────────────────────────────────────────
    %% BOUNDED CONTEXT: BackupAndRestore (backup-service)
    %% ─────────────────────────────────────────

    class Snapshot {
        <<ValueObject>>
        +string originalFilePath
        +string snapshotPath
        +Date timestamp
        +number sizeBytes
        +string previewLine
        +isNewerThan(other: Snapshot) boolean
    }

    class BackupPolicy {
        <<ValueObject>>
        +number maxSnapshotsPerFile
        +exceedsLimit(count: number) boolean
    }

    %% ─────────────────────────────────────────
    %% BOUNDED CONTEXT: MCPManagement (mcp-manager)
    %% ─────────────────────────────────────────

    class McpModule {
        <<AggregateRoot>>
        +string name
        +string displayName
        +string description
        +string version
        +string author
        +string repositoryUrl
        +JsonSchema configSchema
        +string minClaudeVersion
        +boolean authRequired
        +string authKeyLabel
        +validateConfig(config: Record) boolean
    }

    class McpInstallation {
        <<ValueObject>>
        +string moduleName
        +string configFilePath
        +boolean isEnabled
        +boolean hasAuthKey
        +Record config
        +enable() McpInstallation
        +disable() McpInstallation
    }

    class CompatibilityResult {
        <<ValueObject>>
        +boolean isCompatible
        +string detectedClaudeVersion
        +string requiredMinVersion
        +string reason
    }

    %% ─────────────────────────────────────────
    %% REPOSITORY INTERFACES
    %% ─────────────────────────────────────────

    class ISkillNodeRepository {
        <<interface>>
        +findBySlug(slug: string) SkillNode
        +findAll(claudePath: string) SkillNode[]
        +save(node: SkillNode) void
        +toggle(slug: string, enabled: boolean) SkillNode
    }

    class ISnapshotRepository {
        <<interface>>
        +findByFilePath(path: string) Snapshot[]
        +save(snapshot: Snapshot) void
        +deleteOldest(directory: string, keep: number) void
    }

    class IMcpInstallationRepository {
        <<interface>>
        +findByName(name: string) McpInstallation
        +findAll(claudePath: string) McpInstallation[]
        +save(installation: McpInstallation) void
        +delete(name: string) void
    }

    %% ─────────────────────────────────────────
    %% RELATIONSHIPS
    %% ─────────────────────────────────────────

    %% ProjectDiscovery
    ClaudeFolder "1" *-- "1" ClaudeFolderContents : contains
    WorkspaceFolder "1" o-- "many" ClaudeFolder : discovered in
    ClaudeFolder ..> FileEntry : produces

    %% SkillManagement
    DependencyGraph "1" *-- "many" SkillNode : contains nodes
    DependencyGraph "1" *-- "1" GraphValidation : has validation
    GraphValidation "1" *-- "many" BrokenRef : contains

    %% SkillNode → repository
    ISkillNodeRepository ..> SkillNode : manages

    %% AIAssistance
    Suggestion --> SuggestionType : typed as
    Suggestion --> SuggestionSeverity : has severity
    OrchestratorUpdate ..> SkillNode : updates orchestrator for

    %% BackupAndRestore
    Snapshot ..> FileEntry : snapshots
    ISnapshotRepository ..> Snapshot : manages
    BackupPolicy ..> ISnapshotRepository : governs

    %% MCPManagement
    McpInstallation --> McpModule : installed from
    McpModule ..> CompatibilityResult : produces via validate
    IMcpInstallationRepository ..> McpInstallation : manages

    %% Cross-context
    DependencyGraph ..> OrchestratorUpdate : triggers sync for
    SkillNode ..> Suggestion : subject of
    ClaudeFolder o-- "many" McpInstallation : has installed MCPs
    ClaudeFolder o-- "1" AuthState : associated auth
```

---

## Relationship Key

| Symbol | Meaning |
|---|---|
| `*--` | Composition (child owned, lifecycle-bound to parent) |
| `o--` | Aggregation (referenced, independent lifecycle) |
| `-->` | Association (uses / typed as) |
| `..>` | Dependency (produces / manages / triggers) |
| `<\|--` | Inheritance |
| `<\|..` | Interface implementation |

---

## Notes

**Aggregate roots per bounded context:**
- `ClaudeFolder` — ProjectDiscovery: the central entity; all file paths and contents hang off it
- `DependencyGraph` — SkillManagement: owns all nodes, edges, and validation state; rebuilt on every `config:changed`
- `McpModule` — MCPManagement: registry entry; `McpInstallation` is a value object derived from it

**Aggregate invariants:**
- `DependencyGraph`: every edge target must exist as a node slug or be recorded as a `BrokenRef`
- `ClaudeFolder`: `claudePath` must be a subdirectory of `projectPath`
- `McpInstallation`: `config` must satisfy `McpModule.configSchema` before write
- `SkillNode`: `slug` must equal the parent directory name (validated by `FrontmatterParser`)
- `BackupPolicy.maxSnapshotsPerFile` enforced after every `SnapshotFileUseCase` call

**PII fields:**
- `AuthState` — the API key itself is NOT stored in any domain object; it lives in the OS keychain only. `AuthState.keyPresent` is a boolean flag only.
- `McpInstallation.config` must never contain auth keys — `hasAuthKey` is a boolean pointer to the keychain entry only.

**Enable/disable toggle affects:**
- `SkillNode.isEnabled` — written to `enabled: false` in SKILL.md frontmatter (field removed on re-enable)
- `McpInstallation.isEnabled` — written to `enabled` field in MCP JSON config

**Sequence diagrams** (all written):
- [x] `docs/diagrams/claude-project-manager-sequence-scan-workspace.md`
- [x] `docs/diagrams/claude-project-manager-sequence-edit-skill-and-sync.md`
- [x] `docs/diagrams/claude-project-manager-sequence-rollback-file.md`
- [x] `docs/diagrams/claude-project-manager-sequence-install-mcp.md`
- [x] `docs/diagrams/claude-project-manager-sequence-generate-suggestions.md`
- [x] `docs/diagrams/claude-project-manager-sequence-validate-api-key.md`

**State diagrams** (all written):
- [x] `docs/diagrams/claude-project-manager-state-skill-node.md`
- [x] `docs/diagrams/claude-project-manager-state-mcp-installation.md`
- [x] `docs/diagrams/claude-project-manager-state-auth-state.md`
- [x] `docs/diagrams/claude-project-manager-state-orchestrator-update.md`
- [x] `docs/diagrams/claude-project-manager-state-circuit-breaker.md`
