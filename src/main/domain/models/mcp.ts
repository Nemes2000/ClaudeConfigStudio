export interface JsonSchema {
  readonly type: string
  readonly properties?: Record<string, unknown>
  readonly required?: readonly string[]
  readonly [key: string]: unknown
}

export interface McpModule {
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly version: string
  readonly author: string
  readonly repositoryUrl: string
  readonly configSchema: JsonSchema
  readonly minClaudeVersion: string
  readonly authRequired: boolean
  readonly authKeyLabel: string
  validateConfig(configValues: Record<string, unknown>): string[]
}

export interface McpInstallation {
  readonly moduleName: string
  readonly configFilePath: string
  readonly isEnabled: boolean
  readonly hasAuthKey: boolean
  readonly config: Record<string, unknown>
}

export function enableMcpInstallation(inst: McpInstallation): McpInstallation {
  return { ...inst, isEnabled: true }
}

export function disableMcpInstallation(inst: McpInstallation): McpInstallation {
  return { ...inst, isEnabled: false }
}

export interface CompatibilityResult {
  readonly isCompatible: boolean
  readonly detectedClaudeVersion: string
  readonly requiredMinVersion: string
  readonly reason: string
}
