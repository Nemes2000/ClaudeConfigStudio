/**
 * Single source of truth for all IPC channel names and payload types.
 * Channel format: domain:action
 * All channels must be typed — no raw strings in IPC handlers.
 */

// ─────────────────────────────────────────
// Shared types (used in both main and renderer)
// ─────────────────────────────────────────

export interface IpcWorkspaceFolder {
  path: string
  label: string
}

export interface IpcClaudeFolderContents {
  skills: string[]
  rules: string[]
  hooks: string[]
  mcps: string[]
  agentConfig: string | null
}

export interface IpcClaudeFolder {
  projectPath: string
  claudePath: string
  isRootLevel: boolean
  contents: IpcClaudeFolderContents
}

export interface IpcCytoscapeNode {
  data: {
    id: string
    label: string
    isEnabled: boolean
    isMissingFrontmatter: boolean
    isOrchestrator: boolean
  }
}

export interface IpcCytoscapeEdge {
  data: { id: string; source: string; target: string; isBroken: boolean }
}

export interface IpcCytoscapeElements {
  nodes: IpcCytoscapeNode[]
  edges: IpcCytoscapeEdge[]
}

export interface IpcSnapshot {
  originalFilePath: string
  snapshotPath: string
  timestamp: string // ISO 8601
  sizeBytes: number
  previewLine: string
}

export interface IpcAuthState {
  isValid: boolean
  keyPresent: boolean
  lastValidatedAt: string | null // ISO 8601
}

export interface IpcSuggestion {
  type: string
  title: string
  description: string
  affectedSlug: string
  severity: 'info' | 'warning' | 'error'
  affectedSection: string
}

export interface IpcMcpModule {
  name: string
  displayName: string
  description: string
  version: string
  author: string
  repositoryUrl: string
  configSchema: Record<string, unknown>
  minClaudeVersion: string
  authRequired: boolean
  authKeyLabel: string
}

export interface IpcMcpInstallation {
  moduleName: string
  configFilePath: string
  isEnabled: boolean
  hasAuthKey: boolean
  config: Record<string, unknown>
}

export interface IpcCompatibilityResult {
  isCompatible: boolean
  detectedClaudeVersion: string
  requiredMinVersion: string
  reason: string
}

export interface IpcSkillNode {
  slug: string
  name: string
  description: string
  version: string
  filePath: string
  isEnabled: boolean
  dependencies: string[]
  mcpServers: string[]
  diagrams: string[]
  triggers: string[]
  isMissingFrontmatter: boolean
  hasPurposeSection: boolean
  hasInstructionsSection: boolean
}

export interface IpcRuleHierarchy {
  slug: string
  globalPath: string
  supplementPath: string | null
  isGlobalEnabled: boolean
  isSupplementEnabled: boolean | null
}

export interface IpcValidateStructureResult {
  valid: boolean
  missingSections: string[]
  malformedSections: string[]
}

export interface IpcError {
  code: string
  message: string
}

// ─────────────────────────────────────────
// Channel definitions
// ─────────────────────────────────────────

export const IPC_CHANNELS = {
  // Project
  PROJECT_SCAN: 'project:scan',
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_DISCOVERED: 'project:discovered', // push

  // File
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_UPDATE_SECTION: 'file:update-section',
  FILE_DELETE_SECTION: 'file:delete-section',
  FILE_ADD_SECTION: 'file:add-section',
  FILE_ADD_ITEM: 'file:add-item',
  FILE_UPDATE_ITEM: 'file:update-item',
  FILE_DELETE_ITEM: 'file:delete-item',
  FILE_REORDER_ITEM: 'file:reorder-item',

  // Config
  CONFIG_CHANGED: 'config:changed', // push

  // Skill
  SKILL_TOGGLE: 'skill:toggle',
  SKILL_CREATE: 'skill:create',
  SKILL_DELETE: 'skill:delete',
  SKILL_VALIDATE_STRUCTURE: 'skill:validate-structure',

  // Rule
  RULE_TOGGLE: 'rule:toggle',
  RULE_CREATE: 'rule:create',
  RULE_DELETE: 'rule:delete',
  RULE_LIST_GLOBAL: 'rule:list-global',
  RULE_GET_HIERARCHY: 'rule:get-hierarchy',
  RULE_CREATE_SUPPLEMENT: 'rule:create-supplement',
  RULE_HIERARCHY_UPDATED: 'rule:hierarchy-updated', // push

  // Hook
  HOOK_TOGGLE: 'hook:toggle',

  // Graph
  GRAPH_UPDATED: 'graph:updated', // push

  // Backup
  BACKUP_LIST: 'backup:list',
  BACKUP_ROLLBACK: 'backup:rollback',
  BACKUP_CREATED: 'backup:created', // push

  // Orchestrator
  ORCHESTRATOR_SYNC_STARTED: 'orchestrator:sync-started', // push
  ORCHESTRATOR_SYNC_CHUNK: 'orchestrator:sync-chunk', // push
  ORCHESTRATOR_SYNC_COMPLETED: 'orchestrator:sync-completed', // push

  // Auth
  AUTH_VALIDATE: 'auth:validate',
  AUTH_STATE_CHANGED: 'auth:state-changed', // push

  // Suggestions
  SUGGESTION_REQUEST: 'suggestion:request',
  SUGGESTION_READY: 'suggestion:ready', // push

  // MCP
  MCP_LIST_MARKETPLACE: 'mcp:list-marketplace',
  MCP_VALIDATE_COMPATIBILITY: 'mcp:validate-compatibility',
  MCP_INSTALL: 'mcp:install',
  MCP_UNINSTALL: 'mcp:uninstall',
  MCP_TOGGLE: 'mcp:toggle',
  MCP_SET_AUTH_KEY: 'mcp:set-auth-key',
  MCP_LIST_INSTALLED: 'mcp:list-installed',

  // Rollback
  ROLLBACK_COMPLETED: 'rollback:completed', // push
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ─────────────────────────────────────────
// Request / response payload types per channel
// ─────────────────────────────────────────

export interface ProjectScanRequest {
  workspaceFolders: IpcWorkspaceFolder[]
}

export interface ProjectCreateRequest {
  targetPath: string
  templateName: string
}

export interface FileReadRequest {
  filePath: string
}

export interface FileReadResponse {
  content: string
}

export interface FileWriteRequest {
  filePath: string
  content: string
}

export interface FileDeleteRequest {
  filePath: string
}

export interface SkillToggleRequest {
  filePath: string
  enabled: boolean
}

export interface RuleToggleRequest {
  filePath: string
  enabled: boolean
}

export interface HookToggleRequest {
  filePath: string
  enabled: boolean
}

export interface SkillCreateRequest {
  claudePath: string
  slug: string
  name: string
  description: string
}

export interface SkillCreateResponse {
  filePath: string
  content: string
}

export interface SkillDeleteRequest {
  claudePath: string
  slug: string
}

export interface RuleCreateRequest {
  claudePath: string
  slug: string
  name: string
  description: string
  paths?: string
}

export interface RuleCreateResponse {
  filePath: string
  content: string
}

export interface RuleDeleteRequest {
  claudePath: string
  slug: string
}

export interface RuleListGlobalResponse {
  rules: IpcRuleHierarchy[]
}

export interface RuleGetHierarchyRequest {
  claudePath: string
}

export interface RuleCreateSupplementRequest {
  claudePath: string
  globalSlug: string
}

export interface FileSectionUpdateRequest {
  filePath: string
  sectionHeading: string
  newContent: string
}

export interface FileSectionDeleteRequest {
  filePath: string
  sectionHeading: string
}

export interface FileSectionAddRequest {
  filePath: string
  sectionHeading: string
  content: string
  afterSection?: string
}

export interface FileItemAddRequest {
  filePath: string
  sectionHeading: string
  itemContent: string
  afterIndex?: number
}

export interface FileItemUpdateRequest {
  filePath: string
  sectionHeading: string
  itemIndex: number
  newContent: string
}

export interface FileItemDeleteRequest {
  filePath: string
  sectionHeading: string
  itemIndex: number
}

export interface FileItemReorderRequest {
  filePath: string
  sectionHeading: string
  fromIndex: number
  toIndex: number
}

export interface SkillValidateStructureRequest {
  filePath: string
}

export interface BackupListRequest {
  filePath: string
}

export interface BackupRollbackRequest {
  snapshot: IpcSnapshot
}

export interface AuthValidateRequest {
  apiKey?: string
}

export interface AuthValidateResponse {
  ok: boolean
  authState: IpcAuthState
  code?: string
  message?: string
}

export interface SuggestionRequestPayload {
  skillNode: IpcSkillNode
  fileContent: string
}

export interface McpValidateCompatibilityRequest {
  mcpModule: IpcMcpModule
}

export interface McpInstallRequest {
  mcpModule: IpcMcpModule
  configValues: Record<string, unknown>
  authKey?: string
}

export interface McpUninstallRequest {
  claudePath: string
  name: string
}

export interface McpToggleRequest {
  claudePath: string
  name: string
  enabled: boolean
}

export interface McpSetAuthKeyRequest {
  name: string
  authKey: string
}

export interface McpListInstalledRequest {
  claudePath: string
}
