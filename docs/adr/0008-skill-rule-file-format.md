# 0008 — Use YAML frontmatter to declare structured metadata in skill and rule files

**Status:** Accepted

**Date:** 2026-03-21

**Supersedes:** [0005 — Parse skill dependencies from file content using regex pattern matching](0005-skill-dependency-parsing-strategy.md)

## Context

CPM parses `.claude/skills/` and `.claude/rules/` files to build a dependency graph, determine required MCP servers, locate referenced diagram files, and match activation triggers. Without a standardized structure, this metadata must be inferred from file body content via regex — an approach that is fragile, ambiguous, and cannot represent fields like MCP server requirements or diagram paths that have no natural textual expression in a Markdown body.

A standardized file format is needed that: (1) machine-readable metadata CPM can parse reliably, (2) does not disrupt the human-readable Markdown body, and (3) is extensible for future fields without breaking existing files.

## Decision

We will use YAML frontmatter (a `---`-delimited YAML block at the top of each file) to declare structured metadata, following Claude Code's own directory-per-entity convention:

```
.claude/
├── skills/
│   └── <skill-name>/
│       └── SKILL.md          ← frontmatter + skill body (directory slug = skill name)
├── rules/
│   └── <rule-name>.md        ← frontmatter + rule body (flat file, no subdirectory)
└── hooks/
    └── <hook-name>/
        └── HOOK.md           ← frontmatter + hook body (or HOOK.sh for shell hooks)
```

**File layout rationale:** Skills use a subdirectory (`skills/<name>/SKILL.md`) to allow co-located supporting files (diagrams, examples). Rules are flat files (`rules/<name>.md`) matching Claude Code's own convention for rule files (e.g. `~/.claude/rules/coding.md`). Hooks follow the skill pattern to support co-located scripts.

The skill directory name is the slug; the rule filename stem is the slug. CPM parses frontmatter using `gray-matter` and treats any file missing a frontmatter block as unmanaged — shown with a warning but not broken.

### Skill file schema (`skills/<name>/SKILL.md`)

```yaml
---
name: spec-service          # required — must match directory name
description: >              # required — one-line human description
  Generates a microservice specification document
version: 1.0.0              # optional — semver, defaults to 1.0.0
triggers:                   # optional — phrases/patterns that activate this skill
  - "spec the * service"
  - "design service *"
dependencies:               # optional — skill directory names this skill invokes
  - spec-system
  - spec-adr
mcp_servers:                # optional — MCP server names required by this skill
  - filesystem
  - github
diagrams:                   # optional — relative paths to diagram files this skill uses
  - docs/diagrams/service-class.md
---
```

### Rule file schema (`rules/<name>.md`)

```yaml
---
name: coding                # required — must match filename stem
description: >              # required — one-line human description
  Coding standards: naming, error handling, code design
version: 1.0.0              # optional — semver, defaults to 1.0.0
paths:                      # optional — file glob patterns that auto-load this rule
  - "src/**/*.py"
  - "src/**/*.ts"
supplements: <slug>         # optional — present on project-level rules that supplement a global rule of the same name
---
```

### Rule supplement schema (project-level `.claude/rules/<name>.md` supplementing `~/.claude/rules/<name>.md`)

When a project rule file has the same filename stem as a global rule, it is treated as a supplement (see ADR 0009). The `supplements` field is informational only — the filename match is authoritative.

```yaml
---
name: coding
description: Project-specific additions to the global coding rule
supplements: coding         # informational — slug of the global rule being supplemented
enabled: true               # optional — default true; disabling supplement leaves global rule active
---
```

### Hook file schema (`hooks/<name>/HOOK.md`)

```yaml
---
name: pre-commit            # required — must match directory name
description: >              # required — one-line human description
  Runs secret scanning before every git commit
version: 1.0.0              # optional
triggers:                   # optional — events that invoke this hook
  - pre-commit
  - pre-push
---
```

### Required vs optional fields

| Field | Skill | Rule | Hook | Notes |
|---|---|---|---|---|
| `name` | required | required | required | Must match directory name (skill/hook) or filename stem (rule) |
| `description` | required | required | required | One line, shown in UI |
| `version` | optional | optional | optional | Defaults to `1.0.0` |
| `enabled` | optional | optional | optional | `true` by default; `false` disables the entity |
| `triggers` | optional | — | optional | Activation patterns or hook events |
| `dependencies` | optional | — | — | Explicit skill dependency list |
| `mcp_servers` | optional | — | — | MCP servers required |
| `diagrams` | optional | — | — | Diagram file references |
| `paths` | — | optional | — | Auto-load glob patterns |
| `supplements` | — | optional | — | Slug of the global rule this project rule supplements (informational; filename match is authoritative) |

### Enable/disable behaviour

The same frontmatter toggle semantics apply to **all three entity types** (skills, rules, hooks):

- `enabled` is omitted from new files (treated as `true` — no unnecessary field)
- CPM writes `enabled: false` to frontmatter when the user disables a skill/rule/hook via the toggle UI
- CPM removes the `enabled` field entirely when re-enabling (returns to clean default state — no stale `enabled: true`)
- The toggle write path: `ToggleSkillUseCase` / `ToggleRuleUseCase` / `ToggleHookUseCase` in main-process reads the file, parses frontmatter with `gray-matter`, mutates the `enabled` field, and writes back via `WriteFileUseCase` (which includes a backup snapshot before write)

**Per-entity UI/runtime behaviour when disabled:**

| Entity | UI appearance | Runtime effect |
|---|---|---|
| Skill | Greyed-out node in graph (35% opacity); edges dimmed | Excluded as an orchestrator sync target |
| Rule | Muted entry in rules panel | Excluded from the active rule set passed to Claude |
| Hook | Muted entry in hooks panel | Not executed; `chokidar` trigger ignored |

- Orchestrator sync (`FindOrchestratorsUseCase`) skips disabled skills as dependency targets — a disabled skill will not trigger orchestrator rewrites when modified

## §5 Body Structure

The Markdown body after the frontmatter `---` delimiter must follow a mandatory section structure (defined in full in ADR 0010). Key rules:

- `##`-level headings delimit sections. Required sections must be present; optional sections are included as needed.
- `## Instructions` (skill) and `## Rules` (rule) use **numbered format** (`1.`, `2.`, …). CPM auto-renumbers on insert/delete.
- `## Constraints` (skill) uses **bullet format** (`-`). Each item is a watchout or prohibition.
- Section-level and item-level CRUD operations (add/edit/delete/reorder) are supported by CPM's editor.

**Skill required sections:** `## Purpose`, `## Instructions`
**Rule required sections:** `## Purpose`, `## Rules`
**Supplement sections (all optional):** `## Additions`, `## Overrides`, `## Exclusions`

See ADR 0010 for the full section schema, item format rules, and CRUD behaviour.

---

## Alternatives Considered

### Named Markdown headings (e.g. `## Dependencies`, `## MCP Servers`)
Using standardized Markdown headings within the body avoids any special file format — the entire file remains pure Markdown. However, parsing structured lists under headings is ambiguous (heading content may span multiple formats), and fields like `mcp_servers` and `diagrams` have no natural Markdown representation. Frontmatter is the established convention for machine-readable metadata in Markdown files (used by Jekyll, Hugo, Obsidian, and many others).

### Separate sidecar metadata file (e.g. `spec-service.meta.yaml`)
A companion YAML file per skill would keep skill content and metadata completely separate. However, it doubles the number of files, creates sync problems (skill file and meta file can diverge), and is unfamiliar to users. Frontmatter keeps everything in one file.

### Regex parsing from body content (previous approach — ADR 0005)
Inferring dependencies by searching for `/skill-name` patterns in the body content works for simple dependency detection but cannot represent MCP server requirements, diagram references, or trigger patterns. It is fragile and produces false positives. Explicit frontmatter declarations replace this entirely.

## Consequences

**Positive:**
- All metadata is explicit, unambiguous, and parsed with a standard YAML library (`gray-matter`)
- Dependency graph is built from declared `dependencies` list — no regex, no false positives
- MCP server requirements and diagram references are first-class metadata, enabling CPM features that would be impossible with regex parsing
- Files without frontmatter are gracefully degraded (warning in UI, not broken)
- Extensible: new metadata fields can be added without changing existing files

**Negative / trade-offs:**
- All existing skill and rule files in users' `.claude/` folders lack frontmatter; CPM must offer a migration wizard to add frontmatter to existing files
- Authors of new skills must learn the frontmatter schema; CPM will provide templates and validation to lower this barrier
- YAML frontmatter is not rendered by default in GitHub Markdown preview (shown as a table in some renderers, raw text in others)

**Neutral:**
- `gray-matter` is the de facto Node.js frontmatter parser; it handles edge cases (nested YAML, multi-line strings) reliably
- The `name` field must match the filename slug — CPM validates this on open and warns on mismatch
- Orchestrator sync (ADR 0007) reads `dependencies` from frontmatter to find affected orchestrators when a skill is modified

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
