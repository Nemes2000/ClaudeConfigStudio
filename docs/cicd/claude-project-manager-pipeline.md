# CI/CD Pipeline Specification — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**System:** Claude Project Manager (CPM)
**Stack:** Node.js 20 LTS · Electron 30 · React 18 · TypeScript 5

---

## 1. Pipeline Overview

CPM is a cross-platform desktop application distributed as installable binaries (`.exe`, `.dmg`, `.AppImage`/`.deb`). The pipeline produces signed, versioned installers and publishes them to a GitHub Release.

**Stage order (mandatory — no skipping):**

```
lint → type-check → unit-tests → build-renderer → build-electron
  → integration-tests → security-scan → package → publish
```

Pipeline triggers:
- Every pull request to `develop`
- Every push to `main`
- Manual dispatch for release candidates

---

## 2. Stage Definitions

### Stage 1 — Lint
**Tool:** ESLint + Prettier (via `eslint --max-warnings 0`)
**Scope:** `src/` (main process, renderer, shared)
**Blocks:** everything downstream
**Pass condition:** 0 errors, 0 warnings

```bash
npm run lint
```

---

### Stage 2 — Type Check
**Tool:** TypeScript compiler (`tsc --noEmit`)
**Scope:** all TypeScript source including `src/shared/ipc-channels.ts`
**Blocks:** everything downstream
**Pass condition:** 0 type errors

```bash
npm run type-check
```

---

### Stage 3 — Unit Tests
**Tool:** Vitest (renderer components) + Jest (main process modules)
**Scope:**
- `tests/unit/main/` — main-process use cases, skill-graph-service, backup-service, mcp-manager, ai-suggestion-service (Claude API mocked)
- `tests/unit/renderer/` — React components, Zustand stores, hooks (IPC mocked via `window.ipc` mock)
**Pass condition:** 100% pass rate, ≥ 80% line coverage
**Blocks:** build stages

```bash
npm run test:unit
```

**Key mocking strategy:**
- Claude API (`@anthropic-ai/sdk`): mocked via `vi.mock` — no real API calls in unit tests
- `keytar`: mocked to return test credentials
- `chokidar`: mocked filesystem watcher
- Electron IPC: `window.ipc` mock injected via Vitest setup

---

### Stage 4 — Build Renderer
**Tool:** Vite
**Output:** `dist/renderer/` (static assets)
**Blocks:** Electron build

```bash
npm run build:renderer
```

---

### Stage 5 — Build Electron Main
**Tool:** `electron-builder` (compile main process TypeScript + bundle with renderer)
**Output:** `dist/electron/` (unpacked app)
**Blocks:** integration tests, packaging

```bash
npm run build:main
```

---

### Stage 6 — Integration Tests
**Tool:** Spectron (Electron testing) or Playwright with `electron` launch
**Scope:** `tests/integration/`
**What is tested:**
- App launches and shows OnboardingWizard when no API key present
- File read/write via IPC round-trip (real temp filesystem)
- Backup snapshot creation before file write
- Skill graph parse and Cytoscape element serialization (real SKILL.md files in temp dir)
- MCP install/uninstall (temp `.claude/mcp/` directory)
- Git status on a temp git repo
**Pass condition:** 100% pass rate
**Blocks:** security scan, packaging

```bash
npm run test:integration
```

---

### Stage 7 — Security Scan
**Tools:**

| Tool | What it checks | Blocks |
|---|---|---|
| `npm audit --audit-level=high` | npm dependency CVEs (HIGH/CRITICAL) | publish |
| `semgrep` (OWASP ruleset) | SAST — injection, hardcoded secrets, unsafe IPC patterns | publish |
| `trivy fs .` | Container + filesystem CVE scan on build output | publish |
| `gitleaks detect` | Secret patterns in source (`sk-ant-*`, tokens, passwords) | PR merge |

**Pass condition:** 0 unacknowledged HIGH/CRITICAL CVEs; 0 SAST findings; 0 secret patterns

```bash
npm run security:audit
npm run security:sast
npm run security:scan
```

---

### Stage 8 — Package
**Tool:** `electron-builder`
**Outputs:**
- Windows: `claude-project-manager-{version}-setup.exe` (NSIS installer, code-signed)
- macOS: `claude-project-manager-{version}.dmg` (code-signed + notarized)
- Linux: `claude-project-manager-{version}.AppImage` + `.deb`
**Artifact naming:** includes git commit SHA — never `latest`
**SBOM:** generated and attached to each artifact (`cyclonedx-node`)

```bash
npm run package:win
npm run package:mac
npm run package:linux
```

---

### Stage 9 — Publish
**Trigger:** merge to `main` only (not PRs to `develop`)
**Destination:** GitHub Release (draft) with all platform installers attached
**Auto-update feed:** `latest.yml` / `latest-mac.yml` / `latest-linux.yml` published to GitHub Releases for `electron-updater`

```bash
npm run publish
```

---

## 3. Quality Gates

| Gate | Threshold | Blocks |
|---|---|---|
| Lint errors | 0 | PR merge |
| Type errors | 0 | PR merge |
| Unit test pass rate | 100% | PR merge |
| Unit test coverage | ≥ 80% | PR merge |
| Integration test pass rate | 100% | Publish |
| npm HIGH/CRITICAL CVEs | 0 unacknowledged | Publish |
| SAST findings | 0 | Publish |
| Secret patterns in source | 0 | PR merge |

---

## 4. CI Environment

**Runners:**
- Windows: `windows-latest` (GitHub Actions) — for Windows packaging + code signing
- macOS: `macos-latest` — for DMG packaging + notarization
- Linux: `ubuntu-latest` — for lint, type-check, unit tests, integration tests, Linux packaging

**Matrix strategy:** lint/type-check/unit-tests run on Linux only; packaging runs per-platform in parallel after integration tests pass.

---

## 5. Secrets Management in CI

| Secret | CI store key | Used by |
|---|---|---|
| Apple Developer Certificate | `APPLE_CERTIFICATE` | macOS code signing |
| Apple Notarization credentials | `APPLE_ID`, `APPLE_PASSWORD` | macOS notarization |
| Windows Code Signing Certificate | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Windows signing |
| GitHub token | `GITHUB_TOKEN` | Publish to GitHub Releases |
| Anthropic API key (integration tests) | `ANTHROPIC_API_KEY_TEST` | Integration test Claude API calls |

- All secrets injected via GitHub Actions secrets — never in source or logs
- `ANTHROPIC_API_KEY_TEST` scoped to a test-only account with rate limits
- CI action versions pinned by SHA (e.g. `actions/checkout@abc123`), not by tag

---

## 6. Branch Protection Rules

| Branch | Rules |
|---|---|
| `main` | Require PR; require CI green; no direct push; require code signing on publish |
| `develop` | Require PR; require lint + type-check + unit tests green |

---

## 7. Artifact Retention

- Build artifacts: 7 days (PRs), 30 days (main branch builds)
- Published GitHub Release assets: permanent
- SBOM: attached to every GitHub Release
- Test reports: 30 days
