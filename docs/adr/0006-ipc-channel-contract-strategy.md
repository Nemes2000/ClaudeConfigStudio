# 0006 — Define IPC channels via a shared typed contract module

**Status:** Proposed

**Date:** 2026-03-21

## Context

CPM's renderer process and main process communicate exclusively via Electron IPC. Without a shared contract, channel names and payload shapes are stringly-typed, making refactors error-prone and breaking changes invisible at compile time. The project uses TypeScript throughout; the contract strategy must give both sides full type safety with a single source of truth.

## Decision

We will define all IPC channels in a shared TypeScript module at `src/shared/ipc-channels.ts`. This module exports a typed `IpcChannels` interface mapping channel name strings to their request and response payload types. The main process registers handlers using these types; the renderer invokes channels using the same types via a typed preload bridge (`contextBridge`). No untyped string channel names are used anywhere outside this module.

## Alternatives Considered

### Untyped string constants per feature file
Defining channel name constants locally in each feature (e.g. `const GET_PROJECTS = 'projects:get'` in `projects.ts`) is the simplest approach but scatters the contract across the codebase. Payload types are not enforced, channel name collisions are invisible until runtime, and there is no single place to audit all IPC surface.

### Code generation from a schema (e.g. OpenAPI or JSON Schema)
Generating TypeScript types from a channel schema file (similar to API code generation) would provide a strict contract and enable future tooling. For the scale of this application (~15–20 IPC channels), the overhead of a code generation pipeline is not justified. The shared module approach gives equivalent type safety with simpler tooling.

### tRPC over Electron IPC
Libraries like `electron-trpc` provide an RPC abstraction with automatic type inference across the IPC boundary. This would give excellent ergonomics but introduces a third-party abstraction over Electron's IPC primitives, increasing debugging complexity and coupling to library release cadence. Given the manageable number of channels, a hand-written shared contract is simpler and more transparent.

## Consequences

**Positive:**
- Single source of truth for all IPC channel names and payload types
- TypeScript compiler catches channel name typos and payload shape mismatches at build time
- Preload script exposes a typed `window.ipc` API — no direct `ipcRenderer` calls in renderer components
- Easy to audit the full IPC surface by reading one file

**Negative / trade-offs:**
- Shared module must be importable from both main and renderer build targets — Vite config must include `src/shared/` in both entry points
- Adding a new channel requires editing `ipc-channels.ts`, the main handler, and the preload bridge — three touch points instead of one
- No runtime validation of payloads; malformed IPC calls from renderer bugs will surface as runtime errors, not compile errors

**Neutral:**
- The preload bridge pattern (`contextBridge.exposeInMainWorld`) is required by Electron's security model with `contextIsolation=true`; the typed contract module works naturally with this pattern
- Channel naming convention: `<domain>:<verb>` (e.g. `project:list`, `skill:save`, `backup:rollback`)

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
