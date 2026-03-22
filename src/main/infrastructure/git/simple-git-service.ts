import simpleGit from 'simple-git'
import log from 'electron-log'

export interface IGitService {
  isGitRepo(dir: string): Promise<boolean>
  installPreCommitHook(repoPath: string): Promise<void>
}

const PRE_COMMIT_HOOK_CONTENT = `#!/bin/sh
# Claude Config Studio — secret scanning hook
# Warns if API key patterns are found in staged .claude/ files

PATTERN='sk-ant-[a-zA-Z0-9_\\-]{20,}'
STAGED=$(git diff --cached --name-only | grep '\\.claude/')

if [ -n "$STAGED" ]; then
  for file in $STAGED; do
    if grep -qE "$PATTERN" "$file" 2>/dev/null; then
      echo "WARNING: Possible Anthropic API key detected in $file"
      echo "Review before committing."
    fi
  done
fi
`

export class SimpleGitService implements IGitService {
  async isGitRepo(dir: string): Promise<boolean> {
    try {
      const git = simpleGit(dir)
      await git.status()
      return true
    } catch {
      return false
    }
  }

  async installPreCommitHook(repoPath: string): Promise<void> {
    const { writeFile, chmod } = await import('fs/promises')
    const { join } = await import('path')

    const hookPath = join(repoPath, '.git', 'hooks', 'pre-commit')
    try {
      await writeFile(hookPath, PRE_COMMIT_HOOK_CONTENT, { encoding: 'utf-8', mode: 0o755 })
      await chmod(hookPath, 0o755)
      log.info({ component: 'simple-git-service', op: 'installPreCommitHook', repoPath })
    } catch (err) {
      log.warn({ component: 'simple-git-service', op: 'installPreCommitHook', err })
    }
  }
}
