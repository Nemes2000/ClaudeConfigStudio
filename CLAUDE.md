# CLAUDE.md — Microservice Project

## Project Identity

```
Service name:    claude-config-studio
Domain:          Configuration Management
Team owner:      solo
Repo layout:     monorepo
Primary stack:   TypeScript / Electron / React
```

<!-- Global standards (execution model, rules, roles, checklists) are defined in ~/.claude/CLAUDE.md -->

## Project-Level Rules

See `.claude/rules/` for project-specific overrides:

- @.claude/rules/project_structure_electron.md — project directory layout with specific libraries (keytar, chokidar, simple-git, gray-matter)
- @.claude/rules/data_filesystem.md — `~/.claude/` filesystem patterns: atomic writes, backups, YAML frontmatter, path validation
- @.claude/rules/cicd_electron.md — Electron packaging (electron-builder), code signing, SBOM, GitHub Releases
