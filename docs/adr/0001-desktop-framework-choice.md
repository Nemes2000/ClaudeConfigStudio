# 0001 — Use Electron as the desktop application framework

**Status:** Proposed

**Date:** 2026-03-21

## Context

Claude Project Manager (CPM) is a desktop application that must run on Windows, macOS, and Linux. It requires direct filesystem access to `.claude/` folders, OS keychain integration for storing API keys, Git process integration via `simple-git`, and a rich interactive UI including a graph editor and embedded code editor. The framework choice shapes the entire build pipeline, distribution model, and developer experience.

## Decision

We will use Electron because it provides mature Node.js native module support (required for OS keychain via `keytar` and filesystem watching via `chokidar`), the largest ecosystem of desktop UI libraries compatible with React, and well-established cross-platform packaging and auto-update tooling (`electron-builder`, `electron-updater`).

## Alternatives Considered

### Tauri
Tauri uses a system WebView and a Rust backend, producing smaller binaries and lower memory usage. However, Tauri's Node.js native module support is absent — it requires Rust for backend logic, which would mean rewriting filesystem, keychain, Git, and Anthropic SDK integrations in Rust or bridging via sidecar processes. The Anthropic Node.js SDK is central to the orchestrator sync feature; using it in Tauri would require a separate Node sidecar, negating most of Tauri's advantages while adding complexity.

### NW.js
NW.js offers similar capabilities to Electron but has a smaller community, slower release cadence, and less mature tooling for code signing and auto-update. The `electron-builder` ecosystem is significantly more complete.

### Native app (Swift/Kotlin/C#)
A fully native app per platform would give the best OS integration and performance but requires maintaining three separate codebases and precludes sharing the Anthropic SDK and React UI across platforms.

## Consequences

**Positive:**
- Full Node.js runtime in the main process — Anthropic SDK, `keytar`, `simple-git`, `chokidar` all work without bridging
- Mature cross-platform packaging, code signing, and auto-update (`electron-builder` + `electron-updater`)
- Large ecosystem of React-compatible UI libraries and graph/editor components
- Single codebase for Windows, macOS, and Linux

**Negative / trade-offs:**
- Electron apps ship a bundled Chromium and Node.js, resulting in binary sizes of 100–200 MB and higher memory footprint than Tauri
- Security surface is larger — `contextIsolation=true` and `nodeIntegration=false` must be enforced in the renderer to prevent renderer-side Node.js access
- Startup time is slower than native or Tauri apps

**Neutral:**
- Developer tooling (DevTools, hot reload via Vite) is familiar to web developers
- Auto-update mechanism requires code signing certificates per platform

---

*Status lifecycle: `Proposed` → `Accepted` → `Deprecated`. Once Accepted, this record is immutable. To reverse or change the decision, create a new ADR that supersedes this one.*
