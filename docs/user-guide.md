# Claude Config Studio — User Guide

## Overview

**Claude Config Studio** is a desktop application for managing Claude Code `.claude/` configuration folders. It provides a visual, interactive interface to create, edit, and maintain skills, rules, hooks, and MCP modules across your local projects.

Whether you're setting up your first `.claude` directory or managing complex multi-project configurations, Claude Config Studio simplifies configuration management with:

- **Centralized workspace scanning** — discover all projects and their `.claude/` folders automatically
- **Visual skill graph** — see dependencies and relationships at a glance
- **Smart suggestions** — AI-powered recommendations for configuration improvements
- **Backup & restore** — automatic snapshots with one-click rollback
- **MCP integration** — browse and manage Model Control Protocol modules
- **Orchestrator sync** — stream Claude API updates back to your orchestrator skills
- **Git integration** — optional version control of configuration changes

---

## System Requirements

| Platform | Minimum | Recommended |
|---|---|---|
| **Windows** | Windows 10 (64-bit) | Windows 11 |
| **macOS** | macOS 10.15 Catalina | macOS 13+ |
| **Linux** | Ubuntu 18.04 / Fedora 30 or equivalent | Ubuntu 22.04 LTS |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 500 MB free | 2 GB free (for backups) |

**Runtime dependencies (Linux only):**

- `libsecret-1-0` — OS keychain access (for API key storage)
- `libgtk-3-0`, `libnss3` — Electron/Chromium GUI (usually pre-installed)

The `.deb` package declares these as dependencies and installs them automatically via `apt`.

---

## Installation

### Windows — NSIS Installer (`.exe`)

1. Download `Claude Config Studio Setup 0.1.0.exe` from [GitHub Releases](https://github.com/your-org/claude-config-studio/releases)
2. Double-click the installer
3. Follow the wizard — choose install directory, create shortcuts
4. The app launches automatically when the wizard finishes
5. Find it in **Start Menu → Claude Config Studio** or on your Desktop

> **Windows SmartScreen**: On first run, Windows may show a SmartScreen warning. Click **More info → Run anyway**. This appears because the EV certificate is new; it disappears after enough users install the app.

### Windows — MSI (Enterprise / Group Policy)

```powershell
# Silent install
msiexec /i "claude-config-studio-0.1.0-win.msi" /qn

# With custom install dir
msiexec /i "claude-config-studio-0.1.0-win.msi" /qn INSTALLDIR="C:\Tools\ClaudeConfigStudio"
```

### macOS — DMG

1. Download `Claude Config Studio-0.1.0.dmg` from GitHub Releases
2. Double-click the DMG to mount it
3. Drag **Claude Config Studio** to the **Applications** folder
4. Eject the DMG
5. Launch from **Applications** or **Spotlight** (`⌘ Space` → "Claude Config Studio")

> **Gatekeeper**: On first launch, macOS may warn "Claude Config Studio cannot be opened because it is from an unidentified developer." Right-click the app → **Open** → **Open** to allow it. Once notarized, this warning does not appear.

### Linux — AppImage (Portable)

No installation required — runs directly:

```bash
chmod +x "Claude Config Studio-0.1.0.AppImage"
./"Claude Config Studio-0.1.0.AppImage"
```

> **First run (FUSE):** If you see `AppImages require FUSE`, install it:
> ```bash
> sudo apt-get install -y libfuse2 fuse
> ```

To add to your applications menu, use a tool like [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) or manually create a `.desktop` file.

### Linux — Debian Package (`.deb`)

```bash
sudo dpkg -i claude-config-studio_0.1.0_amd64.deb

# Install any missing runtime dependencies automatically:
sudo apt-get install -f
```

After install, the app appears in your applications menu under **Development → Claude Config Studio**.

### Linux — RPM (Fedora / RHEL / openSUSE)

```bash
sudo rpm -i claude-config-studio-0.1.0.x86_64.rpm

# Or on Fedora:
sudo dnf install ./claude-config-studio-0.1.0.x86_64.rpm
```

### Linux — Snap

```bash
sudo snap install claude-config-studio_0.1.0_amd64.snap --dangerous --classic
```

---

## Quick Start

### 1. Launch the Application

Open Claude Config Studio from your applications menu, Start Menu, or by running the AppImage.

### 2. Onboarding Wizard

On first launch (or when no API key is stored), the **Onboarding Wizard** appears:

1. **Enter your Anthropic API key**
   - Get one from [Anthropic Console](https://console.anthropic.com/api_keys)
   - The key is stored securely in your **OS keychain** — never written to disk in plaintext
   - The key is validated against the Anthropic API before being saved

2. **Workspace scan** runs automatically — the app discovers all `.claude/` folders in your home directory and active projects

3. The main dashboard opens once the scan completes

### 3. Main Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ Claude Config Studio                                   [⚙ Settings]│
├───────────────┬──────────────────────────────┬───────────────────┤
│               │                              │                   │
│  Projects     │    Skill Graph / Editor      │  AI Suggestions   │
│               │                              │                   │
│  ~/.claude/   │  ┌──────┐   ┌──────┐        │  💡 Simplify...   │
│  my-project/  │  │skill1│──▶│skill2│        │  ⚠ Unused dep...  │
│  work-project/│  └──────┘   └──────┘        │  🔗 Merge with... │
│               │                              │                   │
├───────────────┴──────────────────────────────┴───────────────────┤
│  Snapshots: [2026-03-22 13:00] [2026-03-21 09:30] [Restore ▼]   │
└──────────────────────────────────────────────────────────────────┘
```

- **Left sidebar** — project list; click to switch between projects
- **Center** — skill graph or file editor, depending on selected tab
- **Right sidebar** — live AI suggestions from Claude API
- **Bottom bar** — snapshot history with one-click restore

---

## Usage

### Skill Management

#### Creating a Skill

1. Select a project in the left sidebar
2. Open the **Skills** tab
3. Click **+ New Skill**
4. Enter a name (kebab-case, e.g. `code-formatter`)
5. Write the skill content in markdown
6. Optionally add dependencies on other skills
7. Click **Save**

The skill is automatically:
- Written atomically (no partial writes)
- Snapshotted before creation
- Validated for circular dependencies
- Indexed in the graph view

#### Editing a Skill

1. Click the skill node in the graph, or select it from the skill list
2. Edit markdown content or YAML frontmatter in the editor panel
3. Click **Save** — a snapshot is created before the write

#### Deleting a Skill

1. Right-click the skill → **Delete**
2. Confirm — a backup is created first, visible in the Snapshots bar

#### Toggling Skills On/Off

Use the toggle switch next to each skill to enable or disable it. The `enabled` frontmatter key in the skill file is updated automatically. Disabled skills appear gray in the graph.

### Dependency Graph View

The **Graph** tab renders all skills and their `@import` or dependency references as an interactive diagram:

- **Nodes** — skills (green = enabled, gray = disabled)
- **Arrows** — dependency edges
- **Red edges** — circular dependency warnings
- **Orange nodes** — broken references (dependency file missing)

**Controls:**

| Action | How |
|---|---|
| Select skill | Click node |
| Pan graph | Click + drag background |
| Zoom | Scroll wheel |
| Open skill editor | Double-click node |
| See dependency details | Hover over edge |

### Backup & Restore

Every write operation creates an automatic snapshot before modifying the file.

**Snapshot location:** `~/.claude/.backups/<file-path>/<timestamp>.md`

**Retention policy (default):** keep last 20 snapshots per file, delete snapshots older than 90 days.

#### Restore a Snapshot

1. In the **Snapshots** bar at the bottom, click a timestamp
2. A preview of the file content appears
3. Click **Restore** — the current file is backed up first, then the snapshot is written

### MCP Module Management

#### Browse the Marketplace

1. Open the **MCP** tab
2. Click **Browse Marketplace** — fetches available modules (cached for 1 hour)
3. Search or filter by category
4. Click a module to see description, version, and compatibility status

#### Install an MCP Module

1. Click **Install** on a module
2. Enter any required authentication keys (stored in OS keychain — not on disk)
3. Click **Confirm**

#### Manage Installed Modules

- **Enable / Disable** — toggle switch next to each module
- **Configure** — gear icon to edit settings (API keys, versions)
- **Uninstall** — right-click → **Uninstall**

### AI Suggestions Sidebar

The right sidebar shows live suggestions powered by the Claude API:

| Suggestion type | Example |
|---|---|
| Simplification | "This skill could be reduced by 40 tokens" |
| Merge candidate | "Consider merging with `similar-skill`" |
| Unused dependency | "Remove unused dep: `old-skill`" |
| Missing reference | "Skill `helper` referenced but not found" |
| Circular dependency | "`skill-a` ↔ `skill-b` creates a cycle" |

Click any suggestion to:
- Jump to the affected skill in the graph
- Accept an auto-fix (if available)
- Dismiss the suggestion

**API usage:** suggestions are generated on-demand, subject to a circuit breaker (5 failures → paused for 60 seconds) and a rate limiter (max 3 concurrent requests).

### Orchestrator Sync

When you edit a skill that is depended on by an orchestrator, the **Orchestrator Sync** panel streams updates from the Claude API to bring the orchestrator in sync with your changes:

1. Edit and save a skill
2. If orchestrators depend on it, a sync prompt appears
3. Click **Sync** — Claude API streams the updated orchestrator content
4. Review the diff and **Accept** or **Reject**

---

## Configuration

### Settings Panel

Click the **⚙** icon (top-right) to open Settings.

#### API Key

| Setting | Description |
|---|---|
| Current status | Valid / Invalid / Not set |
| Update key | Replace stored API key |
| Test connection | Re-validate against Anthropic API |

#### Workspace

| Setting | Default | Description |
|---|---|---|
| Scan root | `~` (home directory) | Base path for `.claude/` discovery |
| Auto-scan on startup | On | Scan for new projects when app launches |
| Ignored folders | `node_modules`, `.git` | Paths excluded from scan |

#### Backup

| Setting | Default | Description |
|---|---|---|
| Retention — max snapshots | 20 | Keep last N snapshots per file |
| Retention — max age | 90 days | Delete snapshots older than N days |
| Backup location | `~/.claude/.backups/` | Read-only info |

#### Appearance

| Setting | Default | Description |
|---|---|---|
| Theme | System | Light, Dark, or System |
| Font size | 14 px | Editor and UI text size |

#### Advanced

| Setting | Default | Description |
|---|---|---|
| Log level | INFO | DEBUG / INFO / WARN / ERROR |
| View logs | — | Opens log file in default editor |
| HTTP timeout | 30 s | Outbound request timeout (Claude API, MCP) |

---

## Security Notes

### API Key Storage

Your Anthropic API key is **never written to disk in plaintext**.

- It is stored in the **OS keychain** (macOS Keychain, Windows Credential Manager, Linux libsecret)
- It is read from the keychain at startup and held in memory only
- It is never logged, never sent to third parties, never included in backups
- If you clear your OS keychain, re-enter the key in Settings → API Key

### Path Safety

All file paths received from the renderer are validated before any filesystem operation:
- Must resolve inside `~/.claude/`
- Rejected if they contain `..`, null bytes, or non-printable characters

### File Permissions

New files are created with `0600` permissions (owner read/write only).

### Network

All outbound connections use HTTPS:
- Claude API (`api.anthropic.com`) — for suggestions and orchestrator sync
- MCP marketplace — for module listings (1-hour cache)
- GitHub Releases — for auto-update checks

---

## Auto-Update

Claude Config Studio checks for updates automatically on every launch.

1. When a new version is available, a banner appears: **"Update available — v0.2.0"**
2. Click **Download Update** — the installer downloads in the background
3. When ready: **"Update ready — Restart to install"**
4. Click **Restart & Install** — the app relaunches with the new version

Updates are delivered via GitHub Releases and verified by electron-updater before installation.

To check your current version: **Settings → About → Version**.

---

## Troubleshooting

### App Won't Start (All Platforms)

**Symptom:** Application crashes immediately with no window.

**Steps:**
1. Check the log file:
   - **Windows:** `%APPDATA%\Claude Config Studio\logs\main.log`
   - **macOS:** `~/Library/Logs/Claude Config Studio/main.log`
   - **Linux:** `~/.config/Claude Config Studio/logs/main.log`
2. Look for the error message near the end of the log
3. Common causes:

| Log message | Fix |
|---|---|
| `initializeFn is not a function` | Reinstall the app (corrupted installation) |
| `libsecret-1.so.0: cannot open` | `sudo apt-get install libsecret-1-0` (Linux) |
| `keytar.node: invalid ELF` | Reinstall the app (wrong native binary) |

### "API Key Invalid" Error

1. Go to [Anthropic Console](https://console.anthropic.com/api_keys)
2. Check the key hasn't been revoked or expired
3. Generate a new key if needed
4. Update in **Settings → API Key → Update key**
5. Click **Test connection** to verify

### Projects Not Appearing in Sidebar

1. Verify the project has a `.claude/` folder: `ls ~/my-project/.claude/`
2. The folder must contain at least one of: `skills/`, `rules/`, `hooks/`, `mcp/`
3. If you're scanning a custom location, check **Settings → Workspace → Scan root**
4. Click the **⟳ Rescan** button in the left sidebar

### AppImage Won't Run (Linux)

```bash
# FUSE not installed
sudo apt-get install -y libfuse2 fuse

# Run with --no-sandbox if FUSE mount fails in a container/VM
./"Claude Config Studio-0.1.0.AppImage" --no-sandbox
```

### Graph View Freezes

- Usually happens with 100+ interconnected skills
- Zoom out first (scroll wheel) — the renderer culls distant nodes
- Disable unused skills temporarily to reduce graph size
- Restart the app if the renderer is unresponsive (Ctrl+R / Cmd+R)

### Circular Dependency Warning

1. Open the **Graph** tab — red edges indicate cycles
2. Click a red edge to see the conflicting pair
3. Restructure so dependencies flow in one direction only
4. The warning clears automatically after saving

### Backup Restore Failed

```
Error: Failed to restore snapshot
```

1. Check disk space: `df -h ~/.claude/` (need ≥100 MB free)
2. Check backup exists: `ls ~/.claude/.backups/`
3. Close any open editor that may be locking the file
4. Try an older snapshot
5. If all fail, copy the backup file manually: `cp ~/.claude/.backups/<path>/<timestamp>.md ~/.claude/<path>`

### Auto-Update Check Failed (404)

This is expected if the GitHub repository is private or the Releases page hasn't been published yet. The app logs it as a warning and continues normally — no action needed.

---

## Tips & Best Practices

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Skills | kebab-case, descriptive noun | `code-formatter`, `test-generator` |
| Rules | descriptive filename | `naming-conventions.md` |
| Hooks | verb-noun | `pre-commit-lint.sh` |
| MCP modules | as named in marketplace | — |

### Organizing Skills

- Keep each skill focused on a single responsibility (≤40 lines)
- Use dependencies to express relationships — not file includes
- Group related skills in the same `.claude/skills/` folder
- Archive (disable) unused skills instead of deleting them

### API Key Hygiene

- Rotate your API key monthly
- Never commit `.claude/` config files that could somehow contain key material (they don't — the key is in the keychain)
- If the key is compromised: revoke immediately in Anthropic Console, then update in Settings

### Git Integration

Commit your `.claude/` folder changes with meaningful messages:

```bash
git add .claude/
git commit -m "feat(claude): add code-formatter skill"
```

Snapshots created by the app supplement (but don't replace) Git history.

### Performance

- Set **Settings → Advanced → Log level** to `WARN` in production use (reduces disk I/O)
- Increase **Backup → Auto-snapshot interval** if you edit files very frequently
- For workspaces with thousands of folders, add non-project paths to **Ignored folders**

---

## Getting Help

- **Docs:** `/docs/` folder in the project repository
- **GitHub Issues:** [Report bugs or request features](https://github.com/your-org/claude-config-studio/issues)
- **Deployment guide:** `docs/deployment.md` (for building from source)

---

**Version:** 0.1.0
**Last updated:** 2026-03-22
**License:** MIT
