import { Git } from './git.js'

export async function buildGitContext(workingDir: string): Promise<string> {
  const git = new Git(workingDir)

  if (!await git.isRepo()) return ''

  const [branch, status, log] = await Promise.all([
    git.branch(),
    git.status(),
    git.log(5),
  ])

  // Brief file tree (top-level only)
  let tree = ''
  try {
    const proc = Bun.spawn(['ls', '-1'], { cwd: workingDir, stdout: 'pipe', stderr: 'pipe' })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    if (stdout.trim()) {
      tree = '\nProject files:\n' + stdout.trim().split('\n').slice(0, 30).join('\n')
    }
  } catch { /* ignore */ }

  return [
    '# Git Context',
    `Branch: ${branch}`,
    '',
    'Recent commits:',
    log,
    '',
    'Status:',
    status,
  ].join('\n') + tree
}
