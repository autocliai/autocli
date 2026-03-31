export class Git {
  constructor(private cwd: string) {}

  private async run(args: string[]): Promise<{ stdout: string; exitCode: number }> {
    const proc = Bun.spawn(['git', ...args], {
      cwd: this.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    return { stdout: stdout.trim(), exitCode }
  }

  async isRepo(): Promise<boolean> {
    const { exitCode } = await this.run(['rev-parse', '--is-inside-work-tree'])
    return exitCode === 0
  }

  async status(): Promise<string> {
    const { stdout } = await this.run(['status', '--short'])
    return stdout || '(clean)'
  }

  async diff(staged = false): Promise<string> {
    const args = staged ? ['diff', '--cached'] : ['diff']
    const { stdout } = await this.run(args)
    return stdout || '(no changes)'
  }

  async log(count = 10): Promise<string> {
    const { stdout } = await this.run([
      'log', '--oneline', `-${count}`, '--no-decorate',
    ])
    return stdout || '(no commits)'
  }

  async branch(): Promise<string> {
    const { stdout } = await this.run(['branch', '--show-current'])
    return stdout || 'HEAD (detached)'
  }

  async add(files: string[]): Promise<string> {
    const { stdout } = await this.run(['add', ...files])
    return stdout
  }

  async commit(message: string): Promise<string> {
    const { stdout, exitCode } = await this.run(['commit', '-m', message])
    if (exitCode !== 0) return `Commit failed: ${stdout}`
    return stdout
  }

  async diffStat(): Promise<string> {
    const { stdout } = await this.run(['diff', '--stat'])
    return stdout || '(no changes)'
  }
}
