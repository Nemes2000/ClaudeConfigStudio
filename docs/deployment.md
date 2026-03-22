# Deployment Guide — Claude Config Studio

This document describes the build, packaging, and release process for Claude Config Studio, a desktop Electron application distributed via GitHub Releases.

## Build Pipeline Overview

```
Source (TypeScript + React)
  └─→ electron-vite build        → dist/
  └─→ electron-rebuild (keytar)  → native keytar.node
  └─→ electron-builder           → platform installers (release/)
  └─→ GitHub Actions             → publish to GitHub Releases
```

### Artifact Summary

| Platform | Format | Size (approx.) | Install method |
|---|---|---|---|
| **Windows** | `.exe` (NSIS) | ~150 MB | Double-click wizard |
| **Windows** | `.msi` | ~150 MB | `msiexec /i` or Group Policy |
| **macOS** | `.dmg` | ~180 MB | Mount → drag to Applications |
| **macOS** | `.zip` | ~180 MB | Auto-update delta |
| **Linux** | `.AppImage` | ~106 MB | `chmod +x && ./app.AppImage` |
| **Linux** | `.deb` | ~120 MB | `sudo dpkg -i` |
| **Linux** | `.rpm` | ~120 MB | `sudo rpm -i` |
| **Linux** | `.snap` | ~120 MB | `sudo snap install --dangerous` |

### Technology Stack

- **Build tool**: electron-vite 3 (Vite 6 + Electron bundling)
- **Packager**: electron-builder 25
- **Auto-update**: electron-updater (GitHub Releases provider)
- **Native rebuild**: @electron/rebuild (keytar on all platforms)
- **Code signing**: CSC_LINK / WIN_CSC_LINK via CI secrets
- **CI/CD**: GitHub Actions (parallel matrix: ubuntu / windows / macos)

---

## Prerequisites

### For All Platforms

- **Node.js 20 LTS** (tested on 20.x)
- **npm 10+**
- **Git 2.34+**
- **2 GB free disk** (build artifacts)

### For Linux Builds

```bash
sudo apt-get install -y \
  libsecret-1-dev libsecret-1-0 \
  libgtk-3-dev rpm snapcraft fakeroot \
  build-essential python3
```

> `libsecret-1-0` is also a **runtime dependency** for end users — it is declared in the `.deb` `Depends:` field so it installs automatically.

### For macOS Builds

- **macOS 12+**
- **Xcode command-line tools**: `xcode-select --install`
- **Developer ID Application certificate** from Apple Developer account (for signing)
- **notarytool credentials** (Apple ID + app-specific password + team ID) for notarization

### For Windows Builds

- **Windows 10+ or Windows Server 2019+**
- **Visual Studio Build Tools 2019+** (for native module compilation)
- **EV code-signing certificate** (for signing — optional for local builds)

---

## Local Development

### Clone and Install

```bash
git clone https://github.com/your-org/claude-config-studio.git
cd claude-config-studio
npm ci --ignore-scripts          # skip native postinstall scripts
npx electron-rebuild -f -w keytar  # rebuild keytar for the Electron version
```

### Run in Development Mode

```bash
npm run dev
```

> **VS Code users**: VS Code sets `ELECTRON_RUN_AS_NODE=1` in its terminal. The `dev` script handles this automatically via `env -u ELECTRON_RUN_AS_NODE`. If you launch from outside VS Code, no special handling is needed.

### Build (TypeScript + Vite)

```bash
npm run build
```

Outputs compiled assets to `dist/main/`, `dist/preload/`, and `dist/renderer/`.

### Type-check

```bash
npm run typecheck
```

### Unit Tests

```bash
npm run test:unit
npm run test:unit -- --coverage   # with coverage report (≥80% threshold enforced)
```

### Integration Tests (headless)

```bash
# Requires Xvfb on Linux
xvfb-run --auto-servernum npm run test:integration
```

---

## Packaging

### Build for the Current Platform

```bash
npm run build
npx electron-builder
```

Outputs installers to `release/`.

### Build for a Specific Platform

```bash
npx electron-builder --linux    # AppImage + deb + rpm + snap
npx electron-builder --win      # exe (NSIS) + msi
npx electron-builder --mac      # dmg + zip
```

### Expected Artifacts

After `npx electron-builder --linux`:

```
release/
  Claude Config Studio-0.1.0.AppImage          # portable, no install
  claude-config-studio_0.1.0_amd64.deb         # Debian/Ubuntu
  claude-config-studio-0.1.0.x86_64.rpm        # Fedora/RHEL
  claude-config-studio_0.1.0_amd64.snap        # Snap
  linux-unpacked/                               # unpacked directory
```

After `npx electron-builder --win` (from Windows):

```
release/
  Claude Config Studio Setup 0.1.0.exe         # NSIS installer
  Claude Config Studio Setup 0.1.0.exe.blockmap
  claude-config-studio-0.1.0-win.msi           # MSI
  win-unpacked/
```

After `npx electron-builder --mac` (from macOS):

```
release/
  Claude Config Studio-0.1.0.dmg
  Claude Config Studio-0.1.0.dmg.blockmap
  Claude Config Studio-0.1.0-mac.zip           # auto-update zip
  mac/
```

### Quick Smoke Test (Linux)

After building the AppImage, verify it launches:

```bash
# Install runtime dependencies (once)
sudo apt-get install -y libfuse2 fuse libsecret-1-0

# Launch
env -u ELECTRON_RUN_AS_NODE DISPLAY=:0 \
  "./release/Claude Config Studio-0.1.0.AppImage" --no-sandbox
```

Expected log output (in `~/.config/Claude Config Studio/logs/main.log`):

```json
{ "component": "main", "op": "ready" }
{ "component": "project-handlers", "op": "scan", "folderCount": N }
```

---

## Code Signing

### macOS

Signing is controlled by these environment variables (set in CI secrets):

| Variable | Description |
|---|---|
| `CSC_LINK` | Base64-encoded `.p12` certificate file |
| `CSC_KEY_PASSWORD` | Certificate password |
| `APPLE_ID` | Apple Developer account email |
| `APPLE_TEAM_ID` | 10-character team ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |

Entitlements are defined in `build/entitlements.mac.plist`. They allow:
- JIT compilation (required by Electron/Node)
- User-selected file access
- Network client (Claude API)
- Keychain access group

**Notarization** is disabled by default (`notarize: false` in `electron-builder.yml`). To enable for production releases, set `notarize: true` and ensure the Apple credentials are in CI secrets.

To verify a signed app after download:

```bash
spctl -a -v -t install /Applications/Claude\ Config\ Studio.app
# Output: accepted → properly notarized
```

### Windows

| Variable | Description |
|---|---|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` EV certificate |
| `WIN_CSC_KEY_PASSWORD` | Certificate password |

Both the NSIS installer and the unpacked `.exe` are signed. Verify in PowerShell:

```powershell
Get-AuthenticodeSignature "Claude Config Studio Setup 0.1.0.exe"
# Status = Valid
```

### Linux

No code signing required. Verify package integrity via checksum:

```bash
sha256sum -c "Claude Config Studio-0.1.0.AppImage.sha256"
```

---

## Auto-Update

Claude Config Studio uses **electron-updater** to check GitHub Releases on every launch (only when the app is packaged — never in development).

### How It Works

1. On `app.whenReady()`, the main process calls `autoUpdater.checkForUpdatesAndNotify()`
2. If a new GitHub Release is found, the renderer receives `updater:update-available` via IPC
3. The update downloads in the background; when complete, the renderer receives `updater:update-downloaded`
4. The user can trigger install via `updater:install` IPC channel (calls `quitAndInstall()`)
5. Failed update checks (e.g. no internet, repo not public yet) are logged as `WARN` and do not crash the app

### Publish Configuration

Configured in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: your-org
  repo: claude-config-studio
  releaseType: release
```

---

## CI/CD

### Workflows

Two GitHub Actions workflows are included in `.github/workflows/`:

#### `ci.yml` — Continuous Integration

Triggers on every push to `develop`, `feat/**`, `fix/**` branches and pull requests.

Steps:
1. Install system dependencies (libsecret, xvfb)
2. `npm ci --ignore-scripts`
3. `npx electron-rebuild -f -w keytar`
4. `npm run typecheck`
5. `npm run test:unit -- --coverage`
6. `npm run build`
7. `xvfb-run npm run test:integration` (headless Playwright/Electron)

#### `release.yml` — Release Build + Publish

Triggers on push of a `v*.*.*` tag.

Matrix: `ubuntu-latest` / `windows-latest` / `macos-latest` — all three run in parallel.

Steps per platform:
1. Install system dependencies
2. `npm ci --ignore-scripts`
3. `npx electron-rebuild -f -w keytar`
4. `npm run build`
5. `npm run test:unit`
6. `npx electron-builder --<platform> --publish always`

Artifacts uploaded to GitHub Release automatically via `GH_TOKEN`.

### Required GitHub Secrets

Add these in **GitHub Settings → Secrets and variables → Actions**:

| Secret | Used by | Description |
|---|---|---|
| `MAC_CSC_LINK` | macOS build | Base64 `.p12` Developer ID certificate |
| `MAC_CSC_KEY_PASSWORD` | macOS build | Certificate password |
| `APPLE_ID` | macOS build | Apple account email |
| `APPLE_TEAM_ID` | macOS build | 10-char team ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS build | App-specific password |
| `WIN_CSC_LINK` | Windows build | Base64 `.pfx` EV certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows build | Certificate password |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no manual secret needed.

---

## Release Process

### 1. Prepare

Ensure tests pass and version is bumped:

```bash
git checkout develop
npm run test:unit && npm run test:integration
# Edit package.json version: "0.2.0"
git add package.json
git commit -m "chore(release): bump version to 0.2.0"
```

### 2. Create Release Branch

```bash
git checkout -b release/v0.2.0
```

### 3. Update CHANGELOG

```markdown
## [0.2.0] - 2026-04-01

### Added
- Feature X
- Feature Y

### Fixed
- Bug Z
```

Commit:

```bash
git commit -m "chore(release): bump changelog for v0.2.0"
```

### 4. Merge to Main and Tag

```bash
git checkout main
git merge --no-ff release/v0.2.0
git tag -a v0.2.0 -s -m "Release v0.2.0"
git push origin main v0.2.0
```

The `v0.2.0` tag push triggers `release.yml` — GitHub Actions builds all three platforms and publishes installers to GitHub Releases automatically.

### 5. Merge Back to Develop

```bash
git checkout develop
git merge --no-ff release/v0.2.0
git push origin develop
git branch -d release/v0.2.0
git push origin :release/v0.2.0
```

---

## Build Assets

The `build/` directory contains assets required by electron-builder:

| File | Used by | Description |
|---|---|---|
| `build/icon.png` | Linux | 512×512 app icon |
| `build/icon.ico` | Windows | Multi-size ICO (16–256 px) |
| `build/icon.icns` | macOS | ICNS icon |
| `build/dmg-background.png` | macOS | 540×380 DMG window background |
| `build/entitlements.mac.plist` | macOS | Hardened runtime entitlements |
| `build/linux/after-install.sh` | Linux deb | Post-install hook (updates desktop DB) |
| `build/linux/after-remove.sh` | Linux deb | Post-remove hook |

---

## Troubleshooting

### `keytar` fails to build (`gyp ERR!`)

```bash
# macOS
xcode-select --install

# Windows
npm install --global windows-build-tools

# Linux
sudo apt-get install -y build-essential python3 libsecret-1-dev
```

Then rebuild:

```bash
npx electron-rebuild -f -w keytar
```

### App exits immediately: `initializeFn is not a function`

This occurs if the main process imports `electron-log` instead of `electron-log/main`.
`src/main/index.ts` must use:

```ts
import log from 'electron-log/main'
```

### App exits immediately: `electron.app is undefined`

Caused by `ELECTRON_RUN_AS_NODE=1` in the environment (set by VS Code). The `dev` and `start` npm scripts already handle this with `env -u ELECTRON_RUN_AS_NODE`. If launching the binary directly:

```bash
env -u ELECTRON_RUN_AS_NODE ./release/Claude\ Config\ Studio-0.1.0.AppImage
```

### AppImage won't run: `AppImages require FUSE`

```bash
sudo apt-get install -y libfuse2 fuse
```

### Auto-update check fails (404)

Expected when the GitHub repository doesn't exist or is private. The error is logged as `WARN` and the app continues normally. No action needed until a real GitHub Releases page exists.

### Code signing fails (macOS): `Certificate not found`

1. Ensure `CSC_LINK` is base64-encoded: `base64 -i cert.p12 | pbcopy`
2. Verify `CSC_KEY_PASSWORD` has no leading/trailing spaces
3. Check the certificate is a **Developer ID Application** type (not Distribution)

---

## Performance & Size

- **Measured AppImage size**: 106 MB (Electron 33 + Node 20 runtime included)
- **Build time (Linux, CI)**: ~3 minutes (including electron download + keytar rebuild)
- **Build time (all platforms, parallel CI)**: ~5–8 minutes wall clock

---

## Security Checklist

Before each release:

- [ ] `npm audit --omit=dev` — no HIGH/CRITICAL in production deps
- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run test:unit -- --coverage` — ≥80% coverage, all pass
- [ ] `npm run test:integration` — Playwright test passes
- [ ] No secrets in source: `grep -r "sk-ant\|password\|token" src/`
- [ ] All artifacts signed (macOS: notarized; Windows: EV cert)
- [ ] CI logs do not expose certificate passwords or API keys
- [ ] `electron-builder.yml` `publish.releaseType` is `release` (not `draft`)

---

**Last updated:** 2026-03-22
**Version:** 0.1.0
