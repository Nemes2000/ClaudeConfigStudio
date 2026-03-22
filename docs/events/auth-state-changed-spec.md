# Event Specification — auth:state-changed

**Status:** Draft  **Date:** 2026-03-21  **Transport:** Electron IPC push (main → renderer)

## Purpose
Notifies the renderer of any Claude API authentication state change. Drives OnboardingWizard visibility, status bar badge, and AI feature gating.

## Producer
`ai-suggestion-service` — triggered by: app startup validation, key submission, 401/403 from any API call, circuit breaker open/close.

## Consumers
| Consumer | Reaction |
|---|---|
| OnboardingWizard | Show if `isValid=false` |
| StatusBar | Update auth badge |
| SuggestionSidebar | Enable/disable suggestion requests |

## Payload Schema
```typescript
interface AuthStateChangedPayload {
  authState: {
    isValid: boolean;
    keyPresent: boolean;
    lastValidatedAt: string | null;  // ISO 8601
  };
  reason: 'startup' | 'key-submitted' | 'api-401' | 'api-403'
        | 'circuit-open' | 'circuit-closed' | 'key-deleted';
}
```

## Rules
- API key value is **never** included — only `keyPresent: boolean`
- `reason` must not contain raw Anthropic error messages
- Renderer must handle duplicate events gracefully (idempotent)
- `lastValidatedAt` is null on first launch before any validation attempt
