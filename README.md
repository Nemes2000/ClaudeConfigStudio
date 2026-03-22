# Claude Config Studio

Desktop application for managing Claude Code `.claude/` configuration folders across your projects.

**Claude Config Studio** provides a visual, interactive interface to create, edit, and maintain skills, rules, hooks, and MCP modules with dependency tracking, AI suggestions, and version control integration.

## Features

- **Centralized Workspace Scanning** — Discover all projects and their `.claude/` folders with a single click
- **Visual Skill Graph** — Interactive dependency visualization and editing with circular dependency detection
- **Smart Suggestions** — AI-powered recommendations for configuration improvements and optimization
- **Backup & Restore** — Automatic snapshots with one-click rollback to any previous version
- **MCP Integration** — Browse, install, and manage Model Control Protocol modules
- **Git Integration** — Automatic version control of configuration changes with commit tracking
- **Dual Authentication** — Sign in with your Claude account (OAuth PKCE) or an Anthropic API key; credentials stored in OS keychain, never in plaintext files
- **Cross-Platform** — Windows, macOS, and Linux support

## Screenshot

![Claude Config Studio Dashboard](https://via.placeholder.com/800x600?text=Claude+Config+Studio+Dashboard)

*Screenshot placeholder — shows skill graph, project list, and suggestions panel*

## Quick Start

### Download & Install

1. Visit [GitHub Releases](https://github.com/your-org/claude-config-studio/releases)
2. Download the latest installer for your platform:
   - **Windows**: `claude-config-studio-*.exe`
   - **macOS**: `claude-config-studio-*.dmg`
   - **Linux**: `claude-config-studio-*.AppImage` or `.deb`
3. Run the installer and follow prompts
4. Launch Claude Config Studio

### First Launch

1. **Authenticate** — click **Sign in with Claude account** (opens browser) or enter an [Anthropic API key](https://console.anthropic.com/api_keys)
2. The app scans your workspace for `.claude/` folders automatically
3. Select projects to manage
4. Start editing your configuration

For detailed instructions, see the [User Guide](./docs/user-guide.md).

## Development

### Prerequisites

- **Node.js 16+** (recommend 18 LTS)
- **npm 9+**
- **Git 2.34+**

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/claude-config-studio.git
cd claude-config-studio

# Install dependencies
npm install

# Start development server with hot-reload
npm run dev
```

The app will launch with the Electron window connected to the Vite dev server.

### Available Commands

```bash
# Development
npm run dev              # Start dev server with Electron window
npm run preview          # Preview the built app

# Building & Packaging
npm run build            # Compile TypeScript and bundle assets
npm run package          # Build platform-specific installers

# Testing & Quality
npm run test             # Run unit tests (Jest)
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests (Playwright)
npm run lint             # Check code style (ESLint)
npm run typecheck        # Run TypeScript compiler check

# Cleanup
npm run clean            # Remove build artifacts
```

### Project Structure

```
src/
├── main/                      # Electron main process (Node.js)
│   ├── domain/               # Pure domain logic (no I/O)
│   ├── application/          # Use cases and orchestration
│   ├── infrastructure/       # File I/O, git, keychain, HTTP
│   ├── ipc/                 # IPC handlers
│   └── index.ts             # App entry point
├── preload/                  # Electron preload script
├── renderer/                 # React UI (browser environment)
│   ├── components/
│   ├── pages/
│   ├── stores/              # Zustand state management
│   ├── hooks/
│   └── main.tsx
└── shared/
    └── ipc-channels.ts      # IPC contract definitions

tests/
├── unit/                     # Jest tests
├── integration/              # Playwright tests
└── fixtures/                 # Test data

docs/
├── user-guide.md            # End-user documentation
├── deployment.md            # Build, sign, and release guide
├── architecture/            # System design and decisions
├── api/                     # API specifications
└── diagrams/                # Architecture diagrams
```

### Clean Architecture Layers

- **Domain** (`main/domain/`) — Pure business logic, no framework dependencies
- **Application** (`main/application/`) — Use cases and orchestration
- **Infrastructure** (`main/infrastructure/`) — File I/O, external APIs, caching
- **Presentation** (`renderer/`, `ipc/`) — UI and IPC handlers

For more details, see the [Architecture Documentation](./docs/architecture/).

## Building for Release

### Build Steps

```bash
# 1. Install dependencies
npm ci

# 2. Run tests (ensure all pass)
npm run test

# 3. Build the application
npm run build

# 4. Package installers for all platforms
npm run package
```

### Platform-Specific Notes

- **Windows**: Requires EV code-signing certificate (configured via CI secrets)
- **macOS**: Requires Apple Developer ID certificate and notarization via notarytool
- **Linux**: No signing required; AppImage and deb packages created automatically

### Signing & Notarization

Code signing is handled via CI/CD. For details, see [Deployment Guide](./docs/deployment.md).

## Documentation

- **[User Guide](./docs/user-guide.md)** — Installation, usage, troubleshooting
- **[Deployment Guide](./docs/deployment.md)** — Build, sign, package, and release
- **[Architecture Documentation](./docs/architecture/)** — Design decisions and system overview
- **[ADR (Architecture Decision Records)](./docs/adr/)** — Design rationale for key decisions

## Testing

```bash
# Run all unit tests
npm run test:unit

# Run with coverage report
npm run test:unit -- --coverage

# Run integration tests (Playwright)
npm run test:integration

# Run linting
npm run lint

# Check TypeScript types
npm run typecheck
```

Coverage target: **90%** on unit tests.

## Requirements

### System Requirements

- **Windows 10+**, **macOS 10.15+**, or **Linux** (Ubuntu 18.04+, Fedora 30+, or equivalent)
- **4GB RAM** (8GB recommended)
- **500MB free disk space**

### API Requirements

- Anthropic API key (from [console.anthropic.com](https://console.anthropic.com/api_keys))
- Stable internet connection

## Security

- **API Key Storage**: Credentials stored in OS keychain, not in files or environment variables
- **HTTPS Only**: All API communication uses HTTPS with TLS 1.3
- **No PII in Logs**: Application logs exclude API keys and sensitive data
- **Code Signing**: All releases are cryptographically signed
- **Dependency Scanning**: Regular audits via `npm audit` and static analysis

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m "feat: add my feature"`
4. Push to branch: `git push origin feat/my-feature`
5. Open a Pull Request

All PRs must:
- Pass CI checks (tests, linting, type checking)
- Include tests for new functionality
- Follow commit message conventions (Conventional Commits)
- Be reviewed and approved before merging

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) file for details.

## Acknowledgments

Claude Config Studio is built with:

- [Electron](https://www.electronjs.org/) — Desktop application framework
- [React](https://react.dev/) — UI library
- [Vite](https://vitejs.dev/) — Build tool
- [Zustand](https://github.com/pmndrs/zustand) — State management
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python) — Claude API client

## Roadmap

### Phase 1 (v0.1.0 — Current)

- Skill graph visualization
- Dependency tracking and validation
- Backup and restore
- Basic MCP management
- AI suggestions sidebar

### Phase 2 (v0.2.0)

- Advanced graph editing (drag-and-drop nodes, create dependencies)
- Rule optimization suggestions
- Hook editor and templates
- Orchestrator sync integration

### Phase 3 (v0.3.0+)

- Collaborative editing and sync
- Skill marketplace integration
- Custom themes and extensions
- CLI companion tool
- Web-based dashboard

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/claude-config-studio/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/your-org/claude-config-studio/discussions)
- **Community**: Join our [Discord community](https://discord.gg/your-community)

---

**Current Version:** 0.1.0
**Last Updated:** 2026-03-22
**License:** MIT
