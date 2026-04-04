import { Git } from './git.js'
import { readdirSync, statSync } from 'fs'
import path from 'path'

export async function buildGitContext(workingDir: string): Promise<string | null> {
  const git = new Git(workingDir)
  if (!(await git.isRepo())) return null
  try {
    const branch = await git.branch()
    const status = await git.status()
    const log = await git.log(5)
    return `\n## Git Context\nBranch: ${branch}\n\nRecent commits:\n${log}\n\nStatus:\n${status || '(clean)'}\n`
  } catch { return null }
}

export async function buildProjectHint(workingDir: string): Promise<string | null> {
  try {
    const files: string[] = []
    const EXCLUDE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv'])
    const MAX = 50
    function scan(dir: string, depth: number) {
      if (depth > 2 || files.length >= MAX) return
      try {
        for (const entry of readdirSync(dir)) {
          if (EXCLUDE.has(entry)) continue
          if (files.length >= MAX) break
          const full = path.join(dir, entry)
          const rel = path.relative(workingDir, full)
          try {
            if (statSync(full).isDirectory()) { files.push(rel + '/'); scan(full, depth + 1) }
            else files.push(rel)
          } catch {}
        }
      } catch {}
    }
    scan(workingDir, 0)
    if (files.length === 0) return null
    return `\n## Project Files\n${files.join('\n')}\n`
  } catch { return null }
}
