import type { HookDefinition, HookEvent, HookResult } from './types.js'

const HOOK_TIMEOUT = 30_000 // 30 seconds

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

      // Timeout protection — kill hook if it takes too long
      const timeout = setTimeout(() => {
        try { proc.kill('SIGTERM') } catch {}
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 500)
      }, HOOK_TIMEOUT)

      try {
        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])

        clearTimeout(timeout)
        await proc.exited

        if (stdout.trim()) combinedStdout += (combinedStdout ? '\n' : '') + stdout.trim()
        if (stderr.trim()) combinedStderr += (combinedStderr ? '\n' : '') + stderr.trim()

        if (proc.exitCode !== 0) {
          blocked = true
          break
        }
      } catch {
        clearTimeout(timeout)
        combinedStderr += (combinedStderr ? '\n' : '') + `Hook timed out after ${HOOK_TIMEOUT / 1000}s: ${hook.command}`
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
