import * as path from 'path'

export interface WorkspaceFolder {
  readonly path: string
  readonly label: string
}

export function isValidWorkspaceFolder(folder: WorkspaceFolder): boolean {
  return (
    typeof folder.path === 'string' &&
    folder.path.length > 0 &&
    path.isAbsolute(folder.path) &&
    typeof folder.label === 'string' &&
    folder.label.length > 0
  )
}
