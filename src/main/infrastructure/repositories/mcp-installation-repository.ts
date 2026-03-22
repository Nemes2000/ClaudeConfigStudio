import * as fs from 'fs/promises'
import * as path from 'path'
import type { IMcpInstallationRepository } from '../../application/services/i-mcp-installation-repository'
import type { McpInstallation } from '../../domain/models/mcp'
import { atomicWrite } from '../fs/atomic-write'

export class McpInstallationRepository implements IMcpInstallationRepository {
  async findByName(name: string, claudePath: string): Promise<McpInstallation | null> {
    const filePath = path.join(claudePath, 'mcp', `${name}.json`)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as Record<string, unknown>
      return this.fromJson(data, name, filePath)
    } catch {
      return null
    }
  }

  async findAll(claudePath: string): Promise<McpInstallation[]> {
    const mcpDir = path.join(claudePath, 'mcp')
    try {
      const entries = await fs.readdir(mcpDir, { withFileTypes: true })
      const installations: McpInstallation[] = []
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue
        const name = path.basename(entry.name, '.json')
        const filePath = path.join(mcpDir, entry.name)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const data = JSON.parse(content) as Record<string, unknown>
          installations.push(this.fromJson(data, name, filePath))
        } catch {
          // Skip corrupt config files
        }
      }
      return installations
    } catch {
      return []
    }
  }

  async save(installation: McpInstallation): Promise<void> {
    // Never write auth keys to disk — only config
    const toWrite = {
      moduleName: installation.moduleName,
      isEnabled: installation.isEnabled,
      hasAuthKey: installation.hasAuthKey,
      config: installation.config,
    }
    await atomicWrite(
      installation.configFilePath,
      JSON.stringify(toWrite, null, 2),
    )
    // Set restrictive permissions on config files
    await fs.chmod(installation.configFilePath, 0o600)
  }

  async delete(name: string, claudePath: string): Promise<void> {
    const filePath = path.join(claudePath, 'mcp', `${name}.json`)
    await fs.unlink(filePath)
  }

  private fromJson(
    data: Record<string, unknown>,
    name: string,
    filePath: string,
  ): McpInstallation {
    return {
      moduleName: String(data['moduleName'] ?? name),
      configFilePath: filePath,
      isEnabled: data['isEnabled'] !== false,
      hasAuthKey: data['hasAuthKey'] === true,
      config: (data['config'] as Record<string, unknown>) ?? {},
    }
  }
}
