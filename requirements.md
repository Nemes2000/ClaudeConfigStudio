Claude Project Manager — Specification
Overview

Claude Project Manager (CPM) is a desktop application designed to manage .claude folder contents across local development projects.
It simplifies interaction with Claude's project configuration, including skills, rules, hooks, MCPs, and agent setups, providing a unified visual and interactive interface.

The goal is to make working with Claude's configuration easy, auditable, and scalable — suitable for both beginners and advanced AI system designers.

Core Objectives
• Centralized Management: Manage .claude folder configurations across multiple projects from a single desktop dashboard.
• Visual Editing: Create, view, and modify skills, dependencies, and rules through a live, editable graph interface.
• Smart Assistance: Suggest improvements, enforce rule brevity, and validate configurations using built-in checks.
• Extensible Workflow: Integrate MCP marketplace and add external components with minimal manual setup.

Features
Project & Folder Management
• Automatic Discovery: Scan the user's workspace for folders containing .claude directories.
• Context Separation:

- Highlight root-level .claude configuration separately.
- Group project-level .claude folders under their corresponding project.
  • Create New: Ability to create a .claude structure in any folder with default templates for:
- hooks/
- skills/
- rules/
- mcp/
- agent configuration file (agent.yaml or .json)

• Version Control Integration: Detect if the folder is under Git and optionally manage .claude changes as tracked commits.

Skills Management & Dependency Visualization
• Graph View: Show all skills and their interdependencies in an interactive, editable diagram (nodes = skills, edges = dependencies).
• Visual Editing Tools:

- Drag-and-drop new skills directly into the graph.
- Edit connections (dependencies) between skills.
- Define or modify skill content inline (YAML or JSON editor with syntax highlighting).
  • Dependency Validation: Warn on circular dependencies, missing references, or unused skills.
  • Bulk Actions: Rename or refactor multiple skills simultaneously.
  - Agent mode settings
  - MCP server configuration possibility
    • Suggested Improvements (for this use claude code): On open, display hints such as:
  * "This skill could be simplified."
  * "Consider merging with a similar skill."
  * "Unused dependency: remove?"

Rules and Hooks Management
• Rule Generator: Add new rules using descriptive text input; preview generated file(s) before creation.
• Rule Validation:

- Enforce short and optimized rule design (minimized tokens).
- Warn when rule text might exceed token efficiency thresholds.
  • Hooks Editor: Add or edit hook scripts, with syntax highlighting and example templates.
  • Change Simulator: Preview what behavior or trigger a new rule/hook would introduce before saving.

MCP (Model Control Protocol) Management
• MCP Marketplace Integration: Browse, install, or update available MCP modules.
• Local MCP Management: Enable, disable, or edit configuration (authentication keys, versioning, etc.).
• MCP Compatibility Checker: Validate MCP compatibility with current Claude agent version.

Agent Setup Management
• Unified panel for defining:

- Agent identity and personality
- Default and custom prompts
- Skill and rule bindings
- Context management strategy (context trimming, prioritization)
  • Load and save multiple agent profiles.

Intelligent Suggestions & Validation
• Auto-linting: Analyze configurations for best practices, missing metadata, and misreferenced files.
• AI-assisted Suggestions (for this use claude code):

- Suggest missing dependencies for a skill.
- Recommend optimal rule compression (token minimization).
- Offer improvement tips for unclear descriptions.
  • Version Health Indicator: Display green/yellow/red status for configuration health.

UI/UX Enhancements
• Cross-Platform: Electron + React-based UI for Windows, macOS, and Linux.
• Split-View Editor: Show raw code view beside the visual graph.
• Theme Support: Dark/light themes and custom color definitions per .claude context.
• Quick Actions Palette: Command-K style search to create, edit, or navigate between entities quickly.
• Auto-backup & Restore: Save revisions and allow rollback to previous configurations.
• Onboarding Wizard: Help new users create their first .claude setup.

Additional Features (Good-to-Have)
• Import/Export: Share skill packs or agent setups as .claude-pack files.
• Collaboration Mode: Sync .claude configurations via shared Git or local network.
• Documentation Generator: Convert .claude setup into human-readable Markdown docs (skills, hooks, dependencies).
• Plugin System: Allow third-party extension of the dashboard via JavaScript/TypeScript plugins.
• Embedded Claude API Tester: Run prompts or skill tests directly in-app.

Architecture Overview
Frontend
• Framework: React + TypeScript
• Components:

- Workspace Browser
- Skill Graph Editor (D3.js or Cytoscape.js)
- Code Editor (Monaco or CodeMirror)
- Inspector Panel
- Suggestions Sidebar

Backend
• Framework: Node.js (Electron runtime)
• Services:

- File system operations
- Claude configuration parser
- Dependency graph resolver
- MCP module manager
- Update manager
- AI suggestion service (local or Claude API integration)

Data Model Diagram

``mermaid
graph TD
    A[.claude folder] --> B[skills/]
    A --> C[rules/]
    A --> D[hooks/]
    A --> E[mcp/]
    A --> F[agent.yaml]
    B --> G[Skill Dependencies]
    E --> H[MCP Marketplace]
`

Future Directions
• Cloud sync of Claude configurations with user accounts.
• Collaborative editing and commenting system.
• Integration with Anthropic's Claude directly for in-app skill simulation.
• Template library for common configurations and reusable rule packs.

License and Distribution
• Distributed as an open-source project under MIT License or hybrid model with community edition (free) and pro edition (with marketplace access).
• Auto-updated through Electron Updater or manual installer.

A natural extension of this design would be to integrate a semantic search function over all skills and rules, letting users find concepts or dependencies by meaning, not just name — turning the .claude` folder from a static config into a living knowledge graph.
