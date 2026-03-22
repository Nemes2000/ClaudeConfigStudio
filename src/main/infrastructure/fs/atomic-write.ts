import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Atomically writes content to a file using write-to-tmp + rename pattern.
 * Safe on POSIX; uses fs.rename which is atomic within the same filesystem.
 */
export async function atomicWrite(
  filePath: string,
  content: string,
  mode = 0o600,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  try {
    await fs.writeFile(tmpPath, content, { encoding: 'utf-8', mode })
    await fs.rename(tmpPath, filePath)
  } catch (err) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tmpPath)
    } catch {
      // Ignore cleanup error
    }
    throw err
  }
}
