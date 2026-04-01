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

      // Race the process against a timeout so we never hang
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), HOOK_TIMEOUT)
      )

      try {
        const processPromise = (async () => {
          const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ])
          await proc.exited
          return { stdout, stderr }
        })()

        const result = await Promise.race([processPromise, timeoutPromise])

        if (result === 'timeout') {
          try { proc.kill('SIGTERM') } catch {}
          setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 500)
          combinedStderr += (combinedStderr ? '\n' : '') + `Hook timed out after ${HOOK_TIMEOUT / 1000}s: ${hook.command}`
          blocked = true
          break
        }

        if (result.stdout.trim()) combinedStdout += (combinedStdout ? '\n' : '') + result.stdout.trim()
        if (result.stderr.trim()) combinedStderr += (combinedStderr ? '\n' : '') + result.stderr.trim()

        if (proc.exitCode !== 0) {
          blocked = true
          break
        }
      } catch {
        try { proc.kill('SIGKILL') } catch {}
        combinedStderr += (combinedStderr ? '\n' : '') + `Hook failed: ${hook.command}`
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
