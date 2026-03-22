# Deployment Guide — Claude Config Studio

This document describes the build, packaging, and release process for Claude Config Studio, a desktop Electron application distributed via GitHub Releases.

## Build Pipeline Overview

The deployment process consists of these stages:

1. **Build** — Compile TypeScript and assets
2. **Package** — Create platform-specific installers (Windows, macOS, Linux)
3. **Code Sign** — Sign executables and installers with certificates
4. **Generate SBOM** — Create Software Bill of Materials for each artifact
5. **Release** — Publish to GitHub Releases with artifacts and documentation

### Technology Stack

- **Build tool**: electron-vite (combines Vite + Electron)
- **Packager**: electron-builder (NSIS on Windows, DMG on macOS, AppImage/deb on Linux)
- **Code signing**:
  - macOS: `notarytool` (App Store notarization)
  - Windows: EV (Extended Validation) code-signing certificate
- **SBOM generation**: cyclonedx-node (CycloneDX format)

## Prerequisites

### For All Platforms

- **Node.js 16+** (recommend 18 LTS or 20+)
- **npm 9+**
- **Git 2.34+**
- **Artifact space**: 2GB free disk (development build artifacts)

### For macOS Builds

- **macOS 11+** (for Xcode command-line tools)
- **Developer ID Application certificate** from Apple Developer account
- **Notarization credentials** (Apple ID or app-specific password for notarytool)
- **Xcode**: `xcode-select --install` to set up command-line tools

### For Windows Builds

- **Windows 10+ or Windows Server 2019+**
- **Visual Studio Build Tools 2015+** or Visual Studio 2019+ (for native module compilation)
- **EV code-signing certificate** (private key stored securely, not in repository)
- **SignTool** (included with Windows SDK)

### For Linux Builds

- **Ubuntu 18.04+**, **Fedora 30+**, or equivalent
- **Build tools**: `build-essential`, `libx11-dev`, `libxkbfile-dev` (for `keytar` native module)
- **AppImage runtime**: appimage-builder or similar

## Local Development Setup

### Clone and Install

```bash
git clone https://github.com/your-org/claude-config-studio.git
cd claude-config-studio
npm install
```

### Run in Development Mode

```bash
npm run dev
```

This launches the Electron app with hot-reloading for renderer process changes.

### Build the Application (Local)

```bash
npm run build
```

This compiles TypeScript and bundles assets into the `dist/` directory.

### Preview the Built App

```bash
npm run preview
```

Runs the app without Electron, useful for testing the bundled code.

## Packaging for Release

### Step 1: Build

```bash
npm run build
```

Verifies:
- TypeScript compiles without errors
- All assets are bundled
- No missing dependencies

### Step 2: Package Installers

```bash
npm run package
```

This command:
1. Runs `npm run build` (if not already done)
2. Invokes `electron-builder` to create installers for all three platforms (if running on each platform)
3. Outputs artifacts to `dist/` folder

**Note:** To build for a specific platform, set the environment variable:

```bash
# Windows only
npx electron-builder --win

# macOS only
npx electron-builder --mac

# Linux only
npx electron-builder --linux
```

### Step 3: Verify Artifacts

Check that all expected files were created:

```bash
ls -lh dist/
```

Expected output (varies by platform):

```
# Windows
claude-config-studio-0.1.0.exe           (NSIS installer)
claude-config-studio-0.1.0.exe.blockmap  (Delta updates)

# macOS
claude-config-studio-0.1.0.dmg           (DMG image)
claude-config-studio-0.1.0.dmg.blockmap

# Linux
claude-config-studio-0.1.0.AppImage      (AppImage bundle)
claude-config-studio-0.1.0.AppImage.sha256
claude-config-studio_0.1.0_amd64.deb     (Debian package)
```

## Code Signing

### macOS

#### Prerequisites

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create a **Developer ID Application** certificate:
   - Log in to [Apple Developer](https://developer.apple.com/account/)
   - Go to **Certificates, Identifiers & Profiles**
   - Click **+** to create a new certificate
   - Select **Developer ID Application**
   - Upload a Certificate Signing Request (CSR) from Keychain Access
   - Download the certificate and import to Keychain

#### Signing Configuration

In `electron-builder.yml`:

```yaml
mac:
  certificateFile: /path/to/cert.p12
  certificatePassword: ${CERTIFICATE_PASSWORD}  # Injected via CI secret
  identity: "Developer ID Application: Your Name (ABC123XYZ)"
  notarize:
    teamId: ${APPLE_TEAM_ID}
    appleId: ${APPLE_ID}
    appleIdPassword: ${APPLE_ID_PASSWORD}  # App-specific password
```

#### Build and Notarize

```bash
npm run package
```

The build process will:
1. Sign the binary with your Developer ID certificate
2. Submit to Apple for notarization
3. Staple the notarization ticket to the DMG
4. This takes 5–15 minutes

**Notarization Status:**

Check notarization progress:

```bash
xcrun notarytool info <submission-id> \
  --apple-id your-email@example.com \
  --team-id ABC123XYZ
```

#### Verification

After download, users can verify the signature:

```bash
spctl -a -v -t install /Applications/Claude\ Config\ Studio.app
# Output: "accepted" means the app is properly notarized
```

### Windows

#### Prerequisites

1. Obtain an **EV (Extended Validation) code-signing certificate** from a CA (e.g., DigiCert, Sectigo)
2. Import the certificate to the Windows certificate store
3. Keep the private key secure (consider a hardware token or Azure Key Vault)

#### Signing Configuration

In `electron-builder.yml`:

```yaml
win:
  signingHashAlgorithms:
    - sha256  # SHA-1 is deprecated; use SHA-256
  certificateFile: ${CERTIFICATE_FILE}  # Path to .pfx file (injected in CI)
  certificatePassword: ${CERTIFICATE_PASSWORD}  # Injected via CI secret
  signtoolPath: "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe"
```

#### Build and Sign

```bash
npm run package
```

The build process will:
1. Sign the unpacked `.exe` file
2. Sign the NSIS installer `.exe`

**Manual Signing (if needed):**

```bash
signtool sign /f cert.pfx /p password /fd sha256 /tr http://timestamp.sectigo.com /td sha256 "dist/claude-config-studio-0.1.0.exe"
```

#### Verification

Users can verify the signature in PowerShell:

```powershell
Get-AuthenticodeSignature "C:\Program Files\Claude Config Studio\claude-config-studio.exe"
# Output: Status = Valid, SignerCertificate shows your org name
```

### Linux

Linux AppImage and deb packages do not require code signing, but you can optionally verify package integrity:

```bash
# Verify .deb package
ar x claude-config-studio_0.1.0_amd64.deb
# Extracts control.tar.gz, data.tar.gz, debian-binary

# Verify AppImage checksum
sha256sum -c claude-config-studio-0.1.0.AppImage.sha256
```

## SBOM Generation

Generate a CycloneDX Software Bill of Materials for each release artifact:

### Prerequisites

```bash
npm install -g @cyclonedx/npm
```

### Generate SBOM

```bash
cyclonedx-npm --output-file dist/claude-config-studio-0.1.0-bom.json --package-lock-only
```

This creates a JSON file listing:
- All npm dependencies and versions
- License information
- Known vulnerabilities (if scanned against NVD)

### Attach to Release

Include the SBOM with each GitHub Release artifact so consumers can track dependencies.

## CI/CD Pipeline

### GitHub Actions Workflow

The recommended CI/CD setup uses GitHub Actions to build, sign, and release on all three platforms:

1. **Trigger**: Push to `release/*` branch or manual dispatch
2. **Matrix build**: Build for Windows, macOS, and Linux in parallel
3. **Code signing**: Sign artifacts with platform-specific credentials (via secrets)
4. **SBOM generation**: Generate CycloneDX manifest
5. **GitHub Release**: Attach all artifacts and documentation
6. **Notifications**: Slack/email notification on success or failure

### Secrets Management

Store the following in **GitHub Settings > Secrets**:

- `APPLE_ID`: Apple Developer account email
- `APPLE_ID_PASSWORD`: App-specific password from Apple ID settings
- `APPLE_TEAM_ID`: Apple Developer team ID (10 chars)
- `CERTIFICATE_FILE`: Base64-encoded `.p12` (macOS) or `.pfx` (Windows) file
- `CERTIFICATE_PASSWORD`: Certificate password
- `WINDOWS_SIGN_CERTIFICATE`: EV code-signing certificate (Windows)

## Release Process

### Prerequisites

- All tests pass (unit + integration)
- Code review completed
- Version number bumped in `package.json`
- Changelog updated

### Steps

#### 1. Create Release Branch

```bash
git checkout -b release/v0.1.0
```

#### 2. Update Version and Changelog

Edit `package.json`:

```json
{
  "version": "0.1.0"
}
```

Edit `CHANGELOG.md`:

```markdown
## [0.1.0] - 2026-03-22

### Added
- Initial release of Claude Config Studio
- Skill graph visualization and editing
- Dependency validation
- Backup and restore functionality
- MCP module management

### Fixed
- [#123] Circular dependency detection

[0.1.0]: https://github.com/your-org/claude-config-studio/releases/tag/v0.1.0
```

#### 3. Commit Changes

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): bump version to 0.1.0"
```

#### 4. Build and Test

```bash
npm ci
npm run test
npm run build
npm run package
```

#### 5. Create Git Tag

```bash
git tag -a v0.1.0 -m "Release v0.1.0" -s
```

(The `-s` flag signs the tag; requires GPG setup.)

#### 6. Push and Create Release

```bash
git push origin release/v0.1.0
git push origin v0.1.0
```

Then, go to **GitHub** > **Releases** > **Draft new release**:

1. Select tag `v0.1.0`
2. Add release notes (copy from CHANGELOG)
3. Upload artifacts:
   - `dist/claude-config-studio-0.1.0.exe` (Windows)
   - `dist/claude-config-studio-0.1.0.dmg` (macOS)
   - `dist/claude-config-studio-0.1.0.AppImage` (Linux)
   - `dist/claude-config-studio-0.1.0-bom.json` (SBOM)
   - `dist/claude-config-studio_0.1.0_amd64.deb` (Linux deb)
4. Publish release

#### 7. Merge Back to Main and Develop

```bash
git checkout main
git merge --no-ff release/v0.1.0 --message "Merge release v0.1.0 into main"
git push origin main

git checkout develop
git merge --no-ff release/v0.1.0 --message "Merge release v0.1.0 back to develop"
git push origin develop

git branch -d release/v0.1.0
git push origin :release/v0.1.0
```

## Distribution

### Direct Download

Users can download installers from the GitHub Releases page.

### Auto-Update

Claude Config Studio includes built-in update checking:

1. On startup, the app queries GitHub API for the latest release
2. If a new version is available, a notification is shown
3. Users can click **Update** to download and install the latest version
4. The update is installed in the background with a restart prompt

### Future: Package Managers

To distribute via package managers:

- **Windows**: Microsoft Store (requires additional signing)
- **macOS**: Mac App Store or Homebrew (`brew install claude-config-studio`)
- **Linux**: Snap Store (`snap install claude-config-studio`) or Flatpak

## Troubleshooting

### Build Fails: Missing Native Dependencies

**Error**: `gyp ERR! build error` when building `keytar` or `proper-lockfile`

**Solution**:
- **macOS**: `xcode-select --install` to install Xcode command-line tools
- **Windows**: Install Visual Studio Build Tools 2019
- **Linux**: `sudo apt-get install build-essential python3`

### Code Signing Fails

**Error**: `Certificate not found` or `Invalid certificate password`

**Solution**:
- Verify the certificate file path is correct
- Check that the certificate password is correct (no typos)
- Ensure the certificate is imported into the OS keychain:
  - macOS: **Keychain Access** > **My Certificates**
  - Windows: **Certmgr.msc** > **Personal** > **Certificates**

### Notarization Fails (macOS)

**Error**: `Notarization failed: The uploaded file is not a valid app package`

**Solution**:
1. Verify that all dependencies are bundled: `ditto -x dist/claude-config-studio-0.1.0.dmg /tmp/check && ls -la /tmp/check`
2. Check that the app is built for the target macOS version
3. Ensure no unsigned dependencies are bundled
4. Try submitting again; Apple's servers sometimes have temporary issues

### EV Certificate Revoked

**Error**: `SignTool: Unable to sign the file`

**Solution**:
1. Check that the certificate has not expired or been revoked
2. Verify on the CA's revocation list
3. If revoked, request a new EV certificate from the CA
4. Update the certificate in CI secrets

## Performance & Optimization

### Build Time

- **First build**: 2–5 minutes (depends on system specs and network)
- **Incremental build**: 30–60 seconds
- **Full release build (all platforms)**: 10–20 minutes

### Artifact Size

- **Windows installer**: 150–200 MB
- **macOS DMG**: 180–250 MB
- **Linux AppImage**: 140–180 MB
- **Linux deb**: 120–160 MB

### Optimization Tips

- Use `.dmgignore` to exclude unnecessary files from DMG
- Enable compression in `electron-builder.yml`: `compression: maximum`
- Remove test files and source maps from distribution build

## Security Checklist

Before each release:

- [ ] Run security audit: `npm audit --production`
- [ ] Run static analysis: `npm run lint`
- [ ] Verify no secrets in artifacts: `npm run build && grep -r "password\|key\|token" dist/`
- [ ] Code review completed
- [ ] Signing certificate is valid and not expired
- [ ] CI/CD logs do not expose credentials
- [ ] SBOM is generated and included in release
- [ ] All artifacts are signed (Windows, macOS)
- [ ] Notarization ticket is stapled to macOS app
- [ ] GitHub Release notes explain changes and any breaking changes

## Documentation

- **User Guide**: `/docs/user-guide.md` — for end users
- **Architecture**: `/docs/architecture/` — for developers
- **API Documentation**: Generated from OpenAPI spec (if applicable)

---

**Last updated:** 2026-03-22
**Version:** 0.1.0
