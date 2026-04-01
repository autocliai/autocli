import { Git } from './git.js'

export async function buildGitContext(workingDir: string): Promise<string> {
  const git = new Git(workingDir)

  if (!await git.isRepo()) return ''

  const [branch, status, log] = await Promise.all([
    git.branch(),
    git.status(),
    git.log(5),
  ])

  const sections = [
    '# Git Context',
    `Branch: ${branch}`,
  ]

  if (status !== '(clean)') {
    sections.push(`\nUncommitted changes:\n${status}`)
  }

  sections.push(`\nRecent commits:\n${log}`)

  return sections.join('\n')
}

export async function buildProjectHint(workingDir: string): Promise<string> {
  try {
    const proc = Bun.spawn(['find', '.', '-maxdepth', '2', '-type', 'f', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*', '-not', '-path', '*/dist/*'], {
      cwd: workingDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    const files = stdout.trim().split('\n').filter(Boolean)
    if (files.length === 0) return ''

    // Cap at 50 files
    const display = files.slice(0, 50)
    const truncated = files.length > 50 ? `\n(... and ${files.length - 50} more files)` : ''

    return `# Project Structure (top 2 levels)\n\n${display.join('\n')}${truncated}`
  } catch {
    return ''
  }
}
