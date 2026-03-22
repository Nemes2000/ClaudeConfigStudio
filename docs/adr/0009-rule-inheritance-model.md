# ADR 0009 — Project-Level Rule Supplements (Rule Inheritance)

**Status:** Accepted
**Date:** 2026-03-22
**Deciders:** TBD

---

## Context

Claude Code supports two rule scopes:
- **Global rules** — `~/.claude/rules/<name>.md` — apply to all projects for a given user
- **Project rules** — `.claude/rules/<name>.md` — apply only to the specific project

Before this ADR, these two scopes were independent. A global rule could not be extended or refined for a specific project without duplicating the entire file or disabling it and rewriting a project-specific replacement.

**Problem:** Power users managing many projects need a way to say "apply the global `check.md` rule, but in this project also enforce these additional constraints" or "override rule #3 from the global version." Duplicating files means changes to the global rule are not reflected in project copies.

---

## Decision

A project-level rule file with the **same filename stem** as a global rule is a **supplement** to that global rule — not a replacement.

**Identification rule:** If `~/.claude/rules/check.md` exists AND `.claude/rules/check.md` exists in the current project, CPM treats the project file as a supplement to the global rule. The match is by filename stem (e.g. `check`). No special marker is required.

**Informational frontmatter field:** Project supplement files may include `supplements: <slug>` in YAML frontmatter to make the relationship explicit to readers. This field is purely documentary — CPM derives the relationship from the filename match, not from this field.

**Behaviour when both files exist:**
- Both files are shown together in the UI (global read-only on left; supplement editable on right)
- Claude receives the global rule file first, then the supplement file appended below a separator
- Disabling the supplement (`enabled: false` in supplement frontmatter) leaves the global rule active
- Disabling the global rule suppresses both the global rule and its supplement (global drives activation)

**Supplement sections (per ADR 0010 body structure):**
- `## Additions` — numbered rules added on top of the global rule in this project
- `## Overrides` — numbered entries referencing global rule numbers that are modified here (format: `1. [Override #3] New stricter version of rule 3`)
- `## Exclusions` — numbered list of global rule numbers not applicable in this project (format: `1. Rule #5 — not applicable because...`)

---

## Consequences

### Positive
- Project-specific specialization without global rule duplication
- Global rule changes propagate automatically (not copied)
- Clear UI showing the inheritance relationship
- Supplement can be deleted without affecting global rule

### Negative / trade-offs
- Filename collision creates an implicit relationship — a deliberate project rule that coincidentally shares a name with a global rule will be treated as a supplement. Mitigated by: supplement indicator in UI is visible on first open; user can rename either file.
- `## Overrides` requires referencing global rule numbers — if global rule reorders its numbered list, Overrides may become stale. Mitigated by: CPM warns when a global rule's numbered list changes and the supplement has Overrides entries.

---

## Alternatives Considered

### Explicit `extends` frontmatter field in project rule
Making the supplement relationship opt-in via `supplements: check` in frontmatter avoids accidental implicit relationships. Rejected because it adds friction — users must know to add the field. Filename match is unambiguous for the intended use case.

### Separate `~/.claude/rules/<name>/project-overrides/<project-name>.md` structure
Storing overrides in the global rule directory co-locates supplements with their parent rule. Rejected because it breaks the clean separation between global (`~/.claude/`) and project (`.claude/`) scopes, and makes project-specific content live outside the project repo.

### Merge into a single file with annotations
Rejected — makes both files harder to edit individually and breaks Claude Code's existing file conventions.
