import path from 'path'
import { existsSync } from 'fs'

export async function loadClaudeMdFiles(workingDir: string): Promise<string> {
  const paths = [path.join(workingDir, 'CLAUDE.md'), path.join(workingDir, '.claude', 'CLAUDE.md')]
  const parts: string[] = []
  for (const p of paths) {
    if (existsSync(p)) parts.push(await Bun.file(p).text())
  }
  return parts.join('\n\n')
}
