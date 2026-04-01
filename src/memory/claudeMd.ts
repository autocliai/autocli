import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const CLAUDE_MD_PATHS = [
  'CLAUDE.md',
  '.claude/CLAUDE.md',
]

export function loadClaudeMdFiles(workingDir: string): string {
  const sections: string[] = []

  for (const rel of CLAUDE_MD_PATHS) {
    const fullPath = join(workingDir, rel)
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8').trim()
      if (content) {
        sections.push(`# From ${rel}\n\n${content}`)
      }
    }
  }

  return sections.join('\n\n---\n\n')
}
