# 0004 — Store secrets in the OS keychain via keytar

**Status:** Proposed

**Date:** 2026-03-21

## Context

CPM must store a Claude API key or subscription token and per-MCP authentication keys. These credentials must never appear in source files, config files, logs, or committed Git history. The app runs as a desktop application with access to the OS-native keychain on all three target platforms (Windows Credential Manager, macOS Keychain, Linux Secret Service via libsecret).

## Decision

We will use `keytar` to store and retrieve all secrets from the OS-native keychain. The Claude API key is stored under service name `claude-project-manager` with account name `anthropic-api-key`. MCP keys are stored under `claude-project-manager/mcp/<mcp-name>`. No secret is ever written to disk in any other location.

## Alternatives Considered

### Environment variable only (`ANTHROPIC_API_KEY`)
Reading the key from an environment variable is simple and works well in CI/server contexts but is problematic for a desktop app: the user must set the variable before launching the app (not user-friendly), it is visible in process listings, and it is not encrypted at rest. Env var support will be provided as a fallback for power users, but the primary storage is the OS keychain.

### Encrypted file in the app data directory
Storing an encrypted file (e.g. AES-256 with a machine-derived key) avoids the `keytar` native module dependency but requires implementing key derivation, handling key rotation, and managing the encryption key — which eventually must be stored somewhere. The OS keychain solves exactly this problem with OS-level protection.

### Plain config file (e.g. `~/.config/cpm/config.json`)
Rejected immediately — stores credentials in plaintext on disk, readable by any process running as the same user, and likely to be accidentally committed to version control.

## Consequences

**Positive:**
- Secrets encrypted at rest using OS-native keychain with OS-level access controls
- No secret ever touches the filesystem in plaintext
- Consistent API across Windows, macOS, and Linux via `keytar`
- Satisfies security requirement: API keys never in source, config files, or logs

**Negative / trade-offs:**
- `keytar` is a native Node.js module requiring platform-specific compilation; Electron's `electron-rebuild` must run after `npm install`
- On Linux, `libsecret` must be installed (`libsecret-1-dev` on Debian/Ubuntu); this is an additional setup step for Linux users
- `keytar` has entered maintenance-only mode — the community fork `@keytar/keytar` or migration to `safeStorage` (Electron built-in) may be needed in future

**Neutral:**
- `ANTHROPIC_API_KEY` environment variable supported as a read-only fallback for users who prefer CLI-style configuration
- Key entry and validation occurs in the onboarding wizard and settings panel; no other component reads keys directly

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
