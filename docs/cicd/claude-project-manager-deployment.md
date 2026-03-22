# Deployment Specification — Claude Project Manager

**Status:** Draft
**Date:** 2026-03-21
**System:** Claude Project Manager (CPM)
**Distribution:** Desktop installer (not a server deployment) — GitHub Releases + Electron auto-updater

---

## 1. Distribution Model

CPM is a desktop application — "deployment" means distributing installer binaries to end users and delivering updates via `electron-updater`. There are no servers, containers, or cloud environments to manage.

| Channel | Artifact | Platform |
|---|---|---|
| GitHub Releases | `claude-project-manager-{version}-setup.exe` | Windows |
| GitHub Releases | `claude-project-manager-{version}.dmg` | macOS |
| GitHub Releases | `claude-project-manager-{version}.AppImage` | Linux |
| GitHub Releases | `claude-project-manager-{version}.deb` | Linux (Debian/Ubuntu) |
| Auto-update feed | `latest.yml`, `latest-mac.yml`, `latest-linux.yml` | All platforms |

---

## 2. Release Process

### Pre-release checklist
- [ ] All CI stages green on `main`
- [ ] CHANGELOG updated (`chore(release): bump changelog for vX.Y.Z`)
- [ ] Version bumped in `package.json` (semver: BREAKING → major, feat → minor, fix/perf → patch)
- [ ] All platform installers signed and notarized (macOS)
- [ ] SBOM generated and attached

### Release steps
1. CI pipeline runs on `main` merge — produces signed artifacts on all platform runners
2. GitHub Release created as **draft** automatically by `electron-builder publish`
3. Maintainer reviews draft release notes and attached artifacts
4. Maintainer publishes the GitHub Release → triggers auto-updater feed update
5. Existing installs receive update notification within 24h (next app launch check)

### Versioning
- Semver tags on `main` only: `vX.Y.Z` (annotated, signed)
- Pre-releases: `vX.Y.Z-beta.N` on `release/*` branches for beta testing
- Never tag before CI is green

---

## 3. Auto-Update Mechanism

**Tool:** `electron-updater` (part of `electron-builder`)

| Parameter | Value |
|---|---|
| Update check frequency | On app launch + every 4 hours while running |
| Update feed | GitHub Releases API (public repo) |
| Download behavior | Download in background; notify user when ready |
| Install behavior | User-triggered restart to apply update (not forced) |
| Rollback | User can install previous version from GitHub Releases manually |
| Delta updates | Not configured for v1 — full installer download |

**Update flow:**
1. App checks GitHub Releases API for newer version
2. If newer version found: download installer in background
3. Show notification: "Update ready — restart to apply"
4. User clicks "Restart" → `electron-updater` applies update and relaunches

**Rollback:**
- No automated rollback (desktop app — no server-side health checks)
- Users can download and install any previous version from GitHub Releases manually
- Backup snapshots of `.claude/` configs are independent of app version — unaffected by rollback

---

## 4. Code Signing

| Platform | Requirement | Tool |
|---|---|---|
| Windows | Authenticode signature (EV certificate preferred) | `electron-builder` + `signtool` |
| macOS | Apple Developer ID signature + notarization | `electron-builder` + `codesign` + `notarytool` |
| Linux | No signing required; `.AppImage` is self-contained | — |

- macOS notarization required for Gatekeeper pass on macOS 10.15+
- Windows EV certificate avoids SmartScreen warnings
- Certificates stored in CI secrets (see pipeline spec) — never in source

---

## 5. Feature Flags

CPM uses a simple compile-time feature flag approach for v1 — no remote flag service.

| Flag | Default | Purpose |
|---|---|---|
| `ENABLE_COLLABORATION_MODE` | `false` | Future: multi-user sync (not implemented in v1) |
| `ENABLE_PLUGIN_SYSTEM` | `false` | Future: third-party JS plugins |
| `ENABLE_CLOUD_SYNC` | `false` | Future: cloud config sync |

Flags are defined in `src/shared/feature-flags.ts` and read at compile time via Vite `define`. Changing a flag requires a new build and release — no runtime toggle.

---

## 6. Environment Topology

CPM has no server environments (dev/staging/prod). The equivalent model:

| "Environment" | What it means | Audience |
|---|---|---|
| Local development | `npm run dev` — Electron in development mode, hot reload | Developers |
| Beta release | `vX.Y.Z-beta.N` GitHub Release pre-release | Beta testers (opt-in) |
| Stable release | `vX.Y.Z` GitHub Release published | All users via auto-updater |

---

## 7. Database Migrations

Not applicable — CPM has no database. All state is in user-owned `.claude/` folder files.

The YAML frontmatter format (ADR 0008) is forward-compatible by design:
- New optional fields added in future versions are safely ignored by older app versions
- Required field additions would constitute a breaking change (major version bump)
- CPM offers a migration wizard for users upgrading from pre-frontmatter `.claude/` structures

---

## 8. Post-Deploy Verification

After publishing a GitHub Release:

| Check | Method | Who |
|---|---|---|
| Installer launches on clean Windows VM | Manual smoke test | Maintainer |
| Installer launches on clean macOS | Manual smoke test | Maintainer |
| AppImage launches on Ubuntu 22.04 | Manual smoke test | Maintainer |
| Auto-updater delivers update to beta install | Automated: update beta install to new version | CI |
| SBOM attached to release | GitHub API check | CI |
| Code signature valid | `sigcheck` (Windows), `spctl` (macOS) | CI |

---

## 9. Incident Response

| Severity | Definition | Response |
|---|---|---|
| CRITICAL | App crashes on launch for all users | Pull GitHub Release; push hotfix immediately |
| HIGH | Data loss (backup not created before write) | Pull release; hotfix within 24h |
| MEDIUM | Feature broken (suggestions fail, graph wrong) | Hotfix within 7 days |
| LOW | UI glitch, minor UX issue | Next planned release |

**Hotfix process:**
1. Cut `hotfix/*` branch from `main`
2. Fix, test locally, push
3. CI must be green
4. Merge to `main` and `develop`
5. Tag and publish new patch release
6. Previous broken release remains on GitHub but release notes updated with "superseded by vX.Y.Z"

**User communication:**
- GitHub Release notes document the issue and fix
- In-app update notification appears within 24h of hotfix publish (next launch check)
