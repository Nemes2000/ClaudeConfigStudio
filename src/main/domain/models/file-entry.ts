export interface FileEntry {
  readonly absolutePath: string
  readonly relativePath: string
  readonly content: string
  readonly exists: boolean
}

export function createFileEntry(
  absolutePath: string,
  relativePath: string,
  content: string,
  exists: boolean,
): FileEntry {
  return { absolutePath, relativePath, content, exists }
}
