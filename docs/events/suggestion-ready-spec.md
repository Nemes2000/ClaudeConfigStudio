# Event Specification — suggestion:ready

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Delivers AI-generated suggestions for a skill or rule file to the SuggestionSidebar. Emitted after `GenerateSuggestionsUseCase` parses the Claude API response.

## Producer
`ai-suggestion-service` (via main) — emitted after `GenerateSuggestionsUseCase` completes, either proactively (on project open) or in response to `suggestion:request`.

## Consumers
| Consumer | Reaction |
|---|---|
| SuggestionStore | Replace suggestions list for `affectedSlug` |
| SuggestionSidebar | Render suggestion cards; highlight affected graph node |

## Payload Schema
```typescript
interface SuggestionReadyPayload {
  affectedSlug: string;
  suggestions: Array<{
    type: 'simplify' | 'merge-candidate' | 'unused-dependency'
        | 'missing-description' | 'improve-triggers' | 'missing-section';
    title: string;          // max 80 chars
    description: string;    // max 500 chars
    severity: 'info' | 'warning' | 'error';
    affectedSection: string | null;  // section name (e.g. "Instructions") or null
  }>;
  modelUsed: string;        // e.g. "claude-sonnet-4-6"
  inputTokens: number;
  generatedAt: string;      // ISO 8601
}
```

## Rules
- `suggestions: []` (empty array) is a valid success state — no issues found
- `severity: 'error'` reserved for actionable problems (broken ref, circular dep, missing required field)
- `severity: 'warning'` for recommendations (simplify, merge-candidate)
- `severity: 'info'` for optional improvements (improve-triggers)
- Suggestions for a slug are invalidated when `config:changed` fires for that slug's file
- `SuggestionStore.setSuggestions()` is a full replacement per slug — idempotent on duplicates
- `affectedSection` is non-null for `missing-section` and `improve-triggers` types; `null` for all others
- Suggestion content must not include raw file content, user paths, or API key patterns
