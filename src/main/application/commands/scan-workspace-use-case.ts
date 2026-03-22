import * as fs from 'fs/promises'
import type { Dirent } from 'fs'
import * as path from 'path'
import type { WorkspaceFolder } from '../../domain/models/workspace-folder'
import {
  type ClaudeFolder,
  type ClaudeFolderContents,
} from '../../domain/models/claude-folder'
import type { FileEntry } from '../../domain/models/file-entry'

export interface ScanWorkspaceResult {
  folders: ClaudeFolder[]
  fileEntriesPerFolder: Map<string, FileEntry[]>
}

/**
 * Recursively discovers all .claude/ directories under the given workspace folders.
 * Returns ClaudeFolder values and the raw FileEntry arrays for graph building.
 */
export async function scanWorkspace(
  workspaceFolders: WorkspaceFolder[],
): Promise<ScanWorkspaceResult> {
  const folders: ClaudeFolder[] = []
  const fileEntriesPerFolder = new Map<string, FileEntry[]>()

  for (const workspace of workspaceFolders) {
    const claudePaths = await findClaudePaths(workspace.path)
    for (const claudePath of claudePaths) {
      const contents = await readClaudeFolderContents(claudePath)
      const isRootLevel = path.dirname(claudePath) === workspace.path
      const projectPath = path.dirname(claudePath)
      const folder: ClaudeFolder = {
        projectPath,
        claudePath,
        isRootLevel,
        contents,
      }
      folders.push(folder)

      const fileEntries = await readFileEntries(contents, claudePath)
      fileEntriesPerFolder.set(claudePath, fileEntries)
    }
  }

  return { folders, fileEntriesPerFolder }
}

async function findClaudePaths(rootPath: string): Promise<string[]> {
  const results: string[] = []
  await walk(rootPath, results)
  return results
}

async function walk(dir: string, results: string[]): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.name === '.claude') {
      results.push(fullPath)
      // Do not descend into .claude directories
    } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
      await walk(fullPath, results)
    }
  }
}

async function readClaudeFolderContents(
  claudePath: string,
): Promise<ClaudeFolderContents> {
  const skills = await globFiles(path.join(claudePath, 'skills'), 'SKILL.md')
  const rules = await globFiles(path.join(claudePath, 'rules'), '*.md')
  const hooks = await globFiles(path.join(claudePath, 'hooks'), 'HOOK.md')
  const mcps = await listDirs(path.join(claudePath, 'mcp'))
  const agentConfigPath = await findAgentConfig(claudePath)

  return { skills, rules, hooks, mcps, agentConfig: agentConfigPath }
}

async function globFiles(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const isExact = !pattern.includes('*')
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isExact) {
          const candidate = path.join(dir, entry.name, pattern)
          try {
            await fs.access(candidate)
            results.push(candidate)
          } catch {
            // file does not exist
          }
        }
      } else if (!isExact) {
        // simple glob: *.md
        if (entry.name.endsWith('.md')) {
          results.push(path.join(dir, entry.name))
        }
      }
    }
  } catch {
    // directory does not exist
  }
  return results
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name))
  } catch {
    return []
  }
}

async function findAgentConfig(claudePath: string): Promise<string | null> {
  for (const name of ['agent.yaml', 'agent.json', 'agent.yml']) {
    const candidate = path.join(claudePath, name)
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // not found
    }
  }
  return null
}

async function readFileEntries(
  contents: ClaudeFolderContents,
  claudePath: string,
): Promise<FileEntry[]> {
  const paths = [
    ...contents.skills,
    ...contents.rules,
    ...contents.hooks,
  ]
  const entries: FileEntry[] = []
  for (const absolutePath of paths) {
    try {
      const content = await fs.readFile(absolutePath, 'utf-8')
      const relativePath = path.relative(claudePath, absolutePath)
      entries.push({ absolutePath, relativePath, content, exists: true })
    } catch {
      const relativePath = path.relative(claudePath, absolutePath)
      entries.push({ absolutePath, relativePath, content: '', exists: false })
    }
  }
  return entries
}
