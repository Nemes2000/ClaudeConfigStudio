import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { scanWorkspace } from '../../../src/main/application/commands/scan-workspace-use-case'
import type { WorkspaceFolder } from '../../../src/main/domain/models/workspace-folder'

describe('scanWorkspace', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-workspace-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty arrays for empty workspace', async () => {
    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])
    expect(result.folders).toHaveLength(0)
    expect(result.fileEntriesPerFolder.size).toBe(0)
  })

  it('discovers a .claude folder at root level', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
    expect(result.folders[0]!.claudePath).toBe(claudePath)
    expect(result.folders[0]!.isRootLevel).toBe(true)
  })

  it('discovers nested .claude folders', async () => {
    const nestedPath = path.join(tmpDir, 'subproject', 'subdir')
    const claudePath = path.join(nestedPath, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
    expect(result.folders[0]!.claudePath).toBe(claudePath)
    expect(result.folders[0]!.isRootLevel).toBe(false)
  })

  it('skips hidden directories except .claude', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true })
    await fs.mkdir(claudePath, { recursive: true })

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
    expect(result.folders[0]!.claudePath).toBe(claudePath)
  })

  it('skips node_modules directories', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(path.join(tmpDir, 'node_modules'), { recursive: true })
    await fs.mkdir(claudePath, { recursive: true })

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
  })

  it('discovers skills, rules, and hooks', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const skillDir = path.join(claudePath, 'skills', 'my-skill')
    const ruleDir = path.join(claudePath, 'rules')
    const hookDir = path.join(claudePath, 'hooks', 'my-hook')

    await fs.mkdir(skillDir, { recursive: true })
    await fs.mkdir(ruleDir, { recursive: true })
    await fs.mkdir(hookDir, { recursive: true })

    const skillMd = path.join(skillDir, 'SKILL.md')
    const ruleMd = path.join(ruleDir, 'my-rule.md')
    const hookMd = path.join(hookDir, 'HOOK.md')

    await fs.writeFile(skillMd, '# skill')
    await fs.writeFile(ruleMd, '# rule')
    await fs.writeFile(hookMd, '# hook')

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
    const contents = result.folders[0]!.contents
    expect(contents.skills).toContain(skillMd)
    expect(contents.rules).toContain(ruleMd)
    expect(contents.hooks).toContain(hookMd)
  })

  it('discovers MCP directories', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const mcpDir = path.join(claudePath, 'mcp', 'my-mcp')
    await fs.mkdir(mcpDir, { recursive: true })

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
    expect(result.folders[0]!.contents.mcps).toContain(mcpDir)
  })

  it('finds agent config files', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    await fs.mkdir(claudePath, { recursive: true })

    const agentYaml = path.join(claudePath, 'agent.yaml')
    await fs.writeFile(agentYaml, 'version: 1')

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    expect(result.folders[0]!.contents.agentConfig).toBe(agentYaml)
  })

  it('reads file contents for discovered files', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const ruleDir = path.join(claudePath, 'rules')
    await fs.mkdir(ruleDir, { recursive: true })

    const ruleMd = path.join(ruleDir, 'my-rule.md')
    const content = '# My Rule\n\nDescription here'
    await fs.writeFile(ruleMd, content)

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    const entries = result.fileEntriesPerFolder.get(claudePath)
    expect(entries).toHaveLength(1)
    expect(entries![0]!.content).toBe(content)
    expect(entries![0]!.exists).toBe(true)
  })

  it('handles missing files gracefully', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const ruleDir = path.join(claudePath, 'rules')
    await fs.mkdir(ruleDir, { recursive: true })

    const ruleMd = path.join(ruleDir, 'missing-rule.md')
    // Don't actually create the file

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    // Manually add reference to simulate discovery
    const skillDir = path.join(claudePath, 'skills', 'test')
    const skillMd = path.join(skillDir, 'SKILL.md')
    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(skillMd, 'test')

    const result = await scanWorkspace([workspace])

    expect(result.folders).toHaveLength(1)
  })

  it('handles multiple workspace folders', async () => {
    const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-workspace-test-2-'))

    try {
      const claudePath1 = path.join(tmpDir, '.claude')
      const claudePath2 = path.join(tmpDir2, '.claude')
      await fs.mkdir(claudePath1, { recursive: true })
      await fs.mkdir(claudePath2, { recursive: true })

      const workspace1: WorkspaceFolder = { path: tmpDir, label: 'test1' }
      const workspace2: WorkspaceFolder = { path: tmpDir2, label: 'test2' }

      const result = await scanWorkspace([workspace1, workspace2])

      expect(result.folders).toHaveLength(2)
      expect(result.fileEntriesPerFolder.size).toBe(2)
    } finally {
      await fs.rm(tmpDir2, { recursive: true, force: true })
    }
  })

  it('does not descend into .claude directories', async () => {
    const claudePath = path.join(tmpDir, '.claude')
    const nestedClaudePath = path.join(claudePath, '.claude')
    await fs.mkdir(nestedClaudePath, { recursive: true })

    const workspace: WorkspaceFolder = { path: tmpDir, label: 'test' }
    const result = await scanWorkspace([workspace])

    // Should only find the outer .claude, not the nested one
    expect(result.folders).toHaveLength(1)
    expect(result.folders[0]!.claudePath).toBe(claudePath)
  })
})
