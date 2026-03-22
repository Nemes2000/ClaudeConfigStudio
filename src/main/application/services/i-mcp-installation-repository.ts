import type { McpInstallation } from '../../domain/models/mcp'

export interface IMcpInstallationRepository {
  findByName(name: string, claudePath: string): Promise<McpInstallation | null>
  findAll(claudePath: string): Promise<McpInstallation[]>
  save(installation: McpInstallation): Promise<void>
  delete(name: string, claudePath: string): Promise<void>
}
