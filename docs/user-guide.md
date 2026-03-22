# Claude Config Studio — User Guide

## Overview

**Claude Config Studio** is a desktop application for managing Claude Code `.claude/` configuration folders. It provides a visual, interactive interface to create, edit, and maintain skills, rules, hooks, and MCP modules across your local projects.

Whether you're setting up your first `.claude` directory or managing complex multi-project configurations, Claude Config Studio simplifies configuration management with:

- **Centralized workspace scanning** — discover all projects and their `.claude/` folders
- **Visual skill graph** — see dependencies and relationships at a glance
- **Smart suggestions** — AI-powered recommendations for configuration improvements
- **Backup & restore** — automatic snapshots with one-click rollback
- **MCP integration** — browse and manage Model Control Protocol modules
- **Git integration** — automatic version control of configuration changes

## Requirements

### System Requirements

- **Windows 10+**, **macOS 10.15+**, or **Linux** (Ubuntu 18.04+, Fedora 30+, or equivalent)
- **4GB RAM** (8GB recommended)
- **500MB free disk space**

### For Development

- **Node.js 16+** (if building from source)

## Installation

### From GitHub Releases (Recommended)

1. Visit the [GitHub Releases](https://github.com/your-org/claude-config-studio/releases) page
2. Download the latest installer for your platform:
   - **Windows**: `claude-config-studio-x.y.z.exe`
   - **macOS**: `claude-config-studio-x.y.z.dmg`
   - **Linux**: `claude-config-studio-x.y.z.AppImage` or `.deb`
3. Run the installer and follow the prompts
4. Launch Claude Config Studio from your applications menu

### On macOS

After opening the `.dmg` file, drag **Claude Config Studio** to the **Applications** folder.

### On Linux (AppImage)

```bash
chmod +x claude-config-studio-*.AppImage
./claude-config-studio-*.AppImage
```

Or install the `.deb` package:

```bash
sudo apt install ./claude-config-studio-*.deb
```

## Quick Start

### 1. Launch the Application

Open Claude Config Studio from your applications menu or start screen.

### 2. Onboarding Wizard

On first launch, you'll see an onboarding wizard:

1. **API Key Setup** — Enter your [Anthropic API key](https://console.anthropic.com/api_keys)
   - The API key is stored securely in your OS keychain (not in plaintext)
   - You can update this anytime in Settings

2. **Workspace Scan** — The app automatically scans your home directory for:
   - `~/.claude/` (root configuration)
   - Any project folders containing `.claude/` subdirectories
   - Git repositories with Claude configurations

3. **Project Selection** — Choose which projects you want to manage

### 3. Explore Your Configuration

The main dashboard shows:

- **Left sidebar**: List of your projects and the root `.claude/` folder
- **Center panel**: Current project configuration with tabs for:
  - **Skills** — skill definitions and dependencies
  - **Rules** — project and domain rules
  - **Hooks** — pre/post commit and lifecycle hooks
  - **MCP** — installed MCP modules
  - **Agent** — agent identity and personality settings
- **Right sidebar**: Suggestions and AI recommendations
- **Bottom**: Snapshot history and backup/restore options

## Usage

### Skill Management

#### Creating a Skill

1. In the **Skills** tab, click **+ New Skill**
2. Enter a descriptive name (e.g., `code-formatter`)
3. Define the skill's purpose in markdown
4. (Optional) Add dependencies on other skills by selecting them from the dropdown
5. Click **Save**

The skill is automatically:
- Validated for circular dependencies
- Backed up
- Indexed for search

#### Editing a Skill

1. Click the skill name in the graph view
2. Edit the markdown content or YAML frontmatter
3. Click **Save** — changes are tracked in git if the project is a repository

#### Deleting a Skill

1. Right-click the skill in the graph view
2. Select **Delete**
3. Confirm the deletion — a backup is created automatically

#### Toggling Skills On/Off

In the skill list, toggle the switch next to each skill to enable or disable it without removing the definition.

### Dependency Graph View

The **Graph** tab shows all skills and their dependencies as an interactive diagram.

- **Nodes** represent skills
- **Edges** (arrows) represent dependencies
- **Green nodes** are active skills
- **Gray nodes** are disabled skills
- **Red edges** indicate circular dependencies (warnings)

**Interactions:**

- Click a node to select it and see details in the inspector
- Drag nodes to rearrange the graph
- Hover over edges to see dependency details
- Scroll to zoom in/out

### Backup & Restore

Claude Config Studio automatically creates snapshots whenever you save changes.

#### View Snapshots

1. Open the **Snapshots** panel at the bottom
2. Each snapshot shows:
   - Timestamp
   - Author (git user, if available)
   - Summary of changes

#### Restore a Previous Version

1. Click the snapshot you want to restore
2. Click **Restore**
3. Confirm — the current version is backed up before reverting

**Backups are stored in**: `~/.claude/.backups/<type>/<name>/<timestamp>/`

### MCP Module Management

#### Browse Available Modules

1. Open the **MCP** tab
2. Click **Browse Marketplace**
3. Search or filter modules by category

#### Install an MCP Module

1. Select a module from the marketplace
2. Click **Install**
3. Configure authentication (API keys, credentials) if required
4. Click **Confirm** — the module is installed and enabled

#### Manage Installed Modules

- **Enable/Disable**: Toggle the switch next to each installed module
- **Configure**: Click the gear icon to edit settings (API keys, version, etc.)
- **Remove**: Right-click and select **Uninstall**

### AI Suggestions Sidebar

The right sidebar displays intelligent suggestions based on your configuration:

- "This skill could be simplified"
- "Consider merging with: `similar-skill`"
- "Unused dependency detected: remove?"
- "Circular dependency warning: `skill-a` ↔ `skill-b`"

Click any suggestion to:
- View the affected skill
- Accept an auto-fix (if available)
- Dismiss the suggestion

### Orchestrator Sync

If you use Claude Code's orchestrator or agent sync features:

1. Open **Settings** → **Orchestrator Integration**
2. Enable **Sync Configuration to Orchestrator**
3. Configure sync:
   - **Auto-sync on save** — automatically push changes
   - **Pull from orchestrator** — import remote agent configurations
   - **Conflict resolution** — choose local-wins or remote-wins strategy

The app will:
- Validate that your local configuration matches the orchestrator schema
- Warn about incompatibilities before syncing
- Log all sync operations

## Configuration

### Settings Panel

Open **Settings** (gear icon, top-right) to configure:

#### API Key

- **Current status**: Shows if API key is stored securely
- **Update key**: Replace your API key
- **Test connection**: Verify the key is valid

#### Workspace

- **Scan location**: Choose which directories to scan for `.claude/` folders
- **Auto-discovery**: Enable or disable automatic workspace scanning on startup
- **Ignored folders**: Add paths to exclude (e.g., `node_modules`, `.git`)

#### Appearance

- **Theme**: Light, Dark, or System (follows OS preference)
- **Font size**: Adjust editor and UI text size

#### Backup

- **Auto-snapshot interval**: Create snapshots every N minutes (default: 10)
- **Retention policy**: Keep last N snapshots (default: 20)
- **Backup location**: View where backups are stored
- **Cleanup old backups**: Remove snapshots older than N days (default: 90)

#### Advanced

- **Log level**: DEBUG, INFO, WARN, or ERROR
- **View logs**: Open the application log file
- **Network timeout**: HTTP request timeout in seconds (default: 30s)

### Security

Your API key is **never** stored in plaintext files. Instead:

1. On launch, the app requests your API key from the OS keychain
2. Communication with Anthropic API uses HTTPS only
3. No API key is logged, cached on disk, or sent to third parties

If you clear your OS keychain, you'll need to re-enter your API key on next launch.

## Troubleshooting

### App Won't Start

**Issue**: Application crashes or hangs on startup.

**Solution**:
1. Check that your API key is correct and hasn't been revoked
2. Verify your network connection
3. Try deleting the app cache: `rm -rf ~/.claude/.cache/`
4. Reinstall the application

### "API Key Invalid"

**Issue**: Error message: "Your API key is invalid or has been revoked."

**Solution**:
1. Log in to [Anthropic Console](https://console.anthropic.com/api_keys)
2. Generate a new API key
3. Update it in Settings → API Key
4. Test the connection

### Workspace Not Discovered

**Issue**: Your projects aren't showing up in the project list.

**Solution**:
1. Verify that your projects have a `.claude/` folder
2. Check that the folder contains at least one of: `skills/`, `rules/`, `hooks/`, `mcp/`, `agent.yaml`
3. If scanning from a custom location, check **Settings** → **Workspace** → **Scan location**
4. Try **Settings** → **Workspace** → **Rescan Now**

### Graph View Crashes

**Issue**: The dependency graph view is unresponsive or crashes.

**Solution**:
1. This may occur with very large skill graphs (100+ skills)
2. Try zooming out to see the full graph
3. Close and reopen the app
4. If persistent, reduce the number of active skills temporarily

### Circular Dependency Warnings

**Issue**: The app warns about circular dependencies between skills.

**Solution**:
1. Open the graph view and look for red edges
2. Click on each red edge to see the conflicting skills
3. Restructure your skills so that dependencies flow in one direction
4. Use the **Dependency** column to see what each skill depends on

### Performance Issues

**Issue**: App is slow or freezes when editing large files.

**Solution**:
1. Check **Settings** → **Advanced** → **Log level** and set to `WARN` or `ERROR` (reduces logging overhead)
2. Disable **Workspace** → **Auto-discovery** if you have thousands of folders
3. Close other applications to free up memory
4. Check **Settings** → **Backup** → **Auto-snapshot interval** — increase the interval if snapshots are running too frequently

### Changes Not Saving

**Issue**: You edit a skill or rule but changes don't persist after closing the app.

**Solution**:
1. Check that you see a **✓ Saved** message after editing
2. Verify that the folder and file have write permissions: `ls -l ~/.claude/skills/`
3. Check if the file is locked by another process
4. If the project is a Git repository, ensure you're not on a detached HEAD

### Backup Restore Failed

**Issue**: "Failed to restore from snapshot" error.

**Solution**:
1. Check that the backup location is accessible: `ls -la ~/.claude/.backups/`
2. Verify disk space (need at least 100MB free)
3. Close any open editors that might be locking the files
4. Try restoring to a different, older snapshot
5. If all snapshots fail, contact support with the log file

## Tips & Best Practices

### Naming Conventions

- **Skills**: kebab-case, descriptive (e.g., `code-formatter`, `test-generator`, `doc-writer`)
- **Rules**: descriptive filenames (e.g., `naming-conventions.md`, `security-rules.md`)
- **Hooks**: verb-noun format (e.g., `pre-commit-lint.sh`, `post-merge-update.sh`)

### Organizing Skills

- Group related skills together (e.g., all code analysis skills in one project)
- Use dependencies to show skill relationships
- Keep skills focused on a single responsibility
- Add clear descriptions and examples in skill metadata

### Git Integration

- Commit your `.claude/` folder changes regularly: `git add .claude && git commit -m "update: skills and rules"`
- The app logs commit messages automatically for each snapshot
- Use the orchestrator sync feature to share configurations across teams

### Performance Optimization

- For projects with 50+ skills, consider splitting into multiple `.claude/` folders
- Archive old or unused skills to reduce graph complexity
- Regularly clean up old snapshots: **Settings** → **Backup** → **Cleanup old backups**

### API Key Management

- Rotate your API key regularly (monthly recommended)
- Don't share your `.claude/` folder with the API key in it (the key is in your keychain, not in the files)
- If your key is compromised, revoke it immediately in the Anthropic Console

## Getting Help

- **Documentation**: See `/docs/` folder in the project repository
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/claude-config-studio/issues)
- **Community**: Join our [Discord community](https://discord.gg/your-community)

## Version & Updates

Current version: **0.1.0**

Claude Config Studio checks for updates on startup. When a new version is available, you'll see a notification. Click **Update** to download and install the latest version.

To check your current version:
1. Open **Settings** (gear icon)
2. Scroll to the bottom
3. Look for "About" section with version number

---

**Last updated:** 2026-03-22
**License:** MIT
