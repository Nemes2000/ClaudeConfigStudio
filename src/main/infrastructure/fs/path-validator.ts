import * as path from 'path'
import { PathTraversalError } from '../../domain/exceptions'

/**
 * Validates that an input path stays within the allowed base directory.
 * Any path received from the renderer process must be validated here.
 * Never trust renderer-provided paths without this check.
 */
export function validatePath(inputPath: string, baseDir: string): string {
  // Reject null bytes and control characters
  if (/[\x00-\x1f]/.test(inputPath)) {
    throw new PathTraversalError(inputPath)
  }

  // Reject explicit traversal sequences before resolving
  if (inputPath.includes('..')) {
    throw new PathTraversalError(inputPath)
  }

  const resolved = path.resolve(inputPath)
  const resolvedBase = path.resolve(baseDir)

  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new PathTraversalError(inputPath)
  }

  return resolved
}
