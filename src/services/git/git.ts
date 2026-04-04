export class Git {
  private cwd: string
  constructor(cwd: string) { this.cwd = cwd }

  async run(...args: string[]): Promise<string> {
    const proc = Bun.spawn(['git', ...args], { cwd: this.cwd, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${stderr}`)
    }
    return stdout.trim()
  }

  async isRepo(): Promise<boolean> { try { await this.run('rev-parse', '--is-inside-work-tree'); return true } catch { return false } }
  async branch(): Promise<string> { return this.run('rev-parse', '--abbrev-ref', 'HEAD') }
  async status(): Promise<string> { return this.run('status', '--short') }
  async log(count = 5): Promise<string> { return this.run('log', '--oneline', `-${count}`) }
  async diff(staged = false): Promise<string> { return this.run(...(staged ? ['diff', '--staged'] : ['diff'])) }
  async add(...files: string[]): Promise<void> { await this.run('add', ...files) }
  async commit(message: string): Promise<string> { return this.run('commit', '-m', message) }
}
