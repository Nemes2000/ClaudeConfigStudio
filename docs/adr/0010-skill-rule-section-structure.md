# ADR 0010 — Mandatory Section-Based Body Structure for Skills and Rules

**Status:** Accepted
**Date:** 2026-03-22
**Deciders:** TBD

---

## Context

Skill and rule files (defined in ADR 0008) use YAML frontmatter for structured metadata. However, the Markdown body after the frontmatter was previously free-form. This created two problems:

1. **AI comprehension:** Claude Code processes skill and rule files as instructions. Free-form prose is less reliably followed than structured, numbered steps. The model performs better when instructions are segmented by named sections with a predictable format.
2. **Structured editing:** CPM needs to perform section-level and item-level CRUD operations (add/edit/delete individual steps or constraints) without parsing arbitrary prose. This requires a predictable body structure.

---

## Decision

All skill and rule files must follow a mandatory section-based body structure after the YAML frontmatter. Sections are `##`-level Markdown headings. Required sections must be present; optional sections are included as needed. Custom sections are allowed after the defined sections.

---

## Skill body structure (`skills/<name>/SKILL.md`)

```markdown
---
(frontmatter)
---

## Purpose
One paragraph describing what this skill does and when it is used.

## Instructions

1. First atomic step — written as an imperative instruction for Claude Code.
2. Second step.
3. Continue until the skill's task is complete.

## Constraints

- Must not do X — describe the watchout or prohibition.
- Watch out for Y — describe potential pitfalls.

## Examples

(Optional — free-form invocation examples or sample outputs.)
```

| Section | Required | Format | CRUD |
|---|---|---|---|
| `## Purpose` | Yes | Free-form paragraph | Section edit |
| `## Instructions` | Yes | Numbered steps (`1.`, `2.`, …) | Per-item: add/edit/delete/reorder |
| `## Constraints` | No | Bullet list (`-`) | Per-item: add/edit/delete/reorder |
| `## Examples` | No | Free-form | Section edit |

---

## Rule body structure (`rules/<name>.md`)

```markdown
---
(frontmatter)
---

## Purpose
One paragraph explaining why this rule exists and what behaviour it enforces.

## Rules

1. First rule — written as a clear, enforceable constraint.
2. Second rule.

## Examples

(Optional — good/bad examples.)
```

| Section | Required | Format | CRUD |
|---|---|---|---|
| `## Purpose` | Yes | Free-form paragraph | Section edit |
| `## Rules` | Yes | Numbered items (`1.`, `2.`, …) | Per-item: add/edit/delete/reorder |
| `## Examples` | No | Free-form | Section edit |

---

## Rule supplement body structure (project-level `.claude/rules/<name>.md`)

```markdown
---
supplements: <global-rule-slug>
(other frontmatter)
---

## Additions

1. Extra rule that applies only in this project.

## Overrides

1. [Override #3] Stricter version: replace global rule 3 with this.

## Exclusions

1. Rule #5 — not applicable in this project because ...
```

| Section | Required | Format | CRUD |
|---|---|---|---|
| `## Additions` | No | Numbered items | Per-item: add/edit/delete/reorder |
| `## Overrides` | No | Numbered items; must reference global rule number | Per-item: add/edit/delete/reorder |
| `## Exclusions` | No | Numbered items; must reference global rule number | Per-item: add/edit/delete/reorder |

---

## Step/item format rules

These rules apply to all numbered and bulleted list sections:

- **Numbered sections** (`Instructions`, `Rules`, `Additions`, `Overrides`, `Exclusions`):
  - Each item begins with `N. ` (digit, period, space)
  - Items are auto-renumbered by CPM on insert or delete — never edit numbers manually in the editor
  - No nested sub-lists — complex logic split into separate sequential items
  - Blank lines between items are allowed for readability

- **Bullet sections** (`Constraints`):
  - Each item begins with `- ` (hyphen, space)
  - Items are positionally indexed for CRUD operations (no numbering displayed)
  - No nested sub-lists

---

## Consequences

### Positive
- Claude Code reliably follows numbered step instructions (improved AI performance)
- CPM can perform surgical per-item edits without full-file replacement
- Consistent structure reduces cognitive load when writing new skills/rules
- Validation is straightforward: check for presence of required `##` headings

### Negative / trade-offs
- Existing skill/rule files without this structure show a structure warning in CPM (not an error — they still load and function). Migration to the structured format is opt-in via the editor.
- Authors cannot use deeply nested Markdown inside Instructions — complex skills may require more steps.

---

## Alternatives Considered

### Free-form Markdown body
Preserves maximum author flexibility. Rejected because it prevents reliable per-section and per-item CRUD operations, and produces inconsistent AI behaviour.

### JSON or YAML body (fully structured)
Provides maximal machine-readability. Rejected because skill/rule files are intended to be human-readable and edited directly in any text editor. Markdown with structured headings is the best balance.

### Single flat numbered list (no sections)
All instructions and constraints in one list. Rejected because mixing "what to do" (instructions) with "what not to do" (constraints) reduces clarity for both Claude and human readers.
