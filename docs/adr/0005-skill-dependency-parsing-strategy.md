# 0005 — Parse skill dependencies from file content using regex pattern matching

**Status:** Superseded by [0008 — Use YAML frontmatter to declare structured metadata in skill and rule files](0008-skill-rule-file-format.md)

> **Supersession note:** ADR 0008 adopts the "explicit frontmatter" approach that was rejected in the Alternatives section below. The field name chosen in ADR 0008 is `dependencies` (not `depends-on` as listed in the rejected alternative). All dependency graph construction now uses declared frontmatter — regex parsing of body content is no longer used.

**Date:** 2026-03-21

## Context

CPM must build a dependency graph where nodes are skill files and edges represent one skill referencing another. Skill files are Markdown documents (`.md`) that may reference other skills by their slash-command name (e.g. `/spec-service`, `/code`, `/ship`). There is no separate manifest — the file content itself is the dependency declaration. The parser must detect these references accurately, handle false positives (e.g. `/` in URLs), and run synchronously on every file change without significant latency.

## Decision

We will parse skill dependencies using regex pattern matching that identifies slash-command references matching known skill names (`/[a-z][a-z0-9-]*`) in skill file content, cross-referenced against the actual set of skill files present in the `.claude/skills/` directory. A reference is recorded as a dependency edge only when the referenced name matches an existing skill filename. This keeps parsing fast, deterministic, and free of external API calls.

## Alternatives Considered

### LLM-assisted extraction via Claude API
Sending each skill file to the Claude API for semantic dependency extraction would handle ambiguous references and could reason about intent. However, it introduces latency (network round-trip per file), cost (API tokens for every graph refresh), and non-determinism (same file could yield different results on repeated calls). Dependency graph construction must be fast and offline-capable; LLM extraction is reserved for the suggestion sidebar where latency is acceptable.

### Full Markdown AST parsing
Parsing skill files into a full Markdown AST (e.g. via `remark`) would allow precise identification of inline code spans, headings, and lists containing skill references. In practice, skill references appear as plain text slash-commands (`/skill-name`) that are reliably matched by regex without needing full AST context. AST parsing adds dependency weight and complexity for marginal accuracy gain on well-structured skill files.

### Require an explicit YAML frontmatter `depends-on` block
Adding a `depends-on: [spec-service, code]` frontmatter section to every skill file would make dependencies explicit and unambiguous. This is rejected because it requires modifying all existing skill files in the user's `.claude/` folder and breaks the principle that the files are the source of truth without any additional metadata layer.

## Consequences

**Positive:**
- Parsing is synchronous, in-process, and runs in under 10ms for typical `.claude/` folder sizes
- No API calls or network dependency for graph construction — works fully offline
- Simple implementation with a single well-tested regex function
- References are validated against existing skill filenames, eliminating false positives from URL paths or other `/word` patterns

**Negative / trade-offs:**
- Cannot detect implicit or semantic dependencies (e.g. a skill that calls another by a variable name or alias)
- Regex may miss references in unusual formatting or multi-line constructs; skill authors must use standard `/skill-name` convention
- If a skill file is renamed, all referencing files' content must be updated — the parser cannot resolve aliases

**Neutral:**
- The validated-against-filesystem approach means the graph automatically reflects the actual skills present; stale references (pointing to deleted skills) appear as broken edges in the UI
- Pattern: `/([a-z][a-z0-9-]+)` matched against the known skill name set

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
