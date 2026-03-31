import type { HookDefinition, HookEvent, HookResult } from './types.js'

export class HookRunner {
  private hooks: HookDefinition[]

  constructor(hooks: HookDefinition[]) {
    this.hooks = hooks
  }

  async run(event: HookEvent, context: Record<string, unknown>): Promise<HookResult> {
    const matching = this.hooks.filter(h => {
      if (h.event !== event) return false
      if (h.pattern && context.tool !== h.pattern) return false
      return true
    })

    if (matching.length === 0) {
      return { exitCode: 0, stdout: '', stderr: '', blocked: false }
    }

    let combinedStdout = ''
    let combinedStderr = ''
    let blocked = false

    for (const hook of matching) {
      const env = {
        ...process.env,
        HOOK_EVENT: event,
        ...Object.fromEntries(
          Object.entries(context).map(([k, v]) => [`HOOK_${k.toUpperCase()}`, String(v)])
        ),
      }

      const proc = Bun.spawn(['bash', '-c', hook.command], {
        stdout: 'pipe',
        stderr: 'pipe',
        env,
      })

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])

      await proc.exited

      combinedStdout += stdout.trim()
      combinedStderr += stderr.trim()

      if (proc.exitCode !== 0) {
        blocked = true
        break
      }
    }

    return {
      exitCode: blocked ? 1 : 0,
      stdout: combinedStdout,
      stderr: combinedStderr,
      blocked,
    }
  }
}
