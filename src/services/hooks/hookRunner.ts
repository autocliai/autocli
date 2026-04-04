import type { HookDefinition } from '../../utils/config.js'
import type { EventBus } from '../events/eventBus.js'
import { logger } from '../../utils/logger.js'

export interface HookResult { exitCode: number; stdout: string; stderr: string }

export class HookRunner {
  private hooks: HookDefinition[]

  constructor(hooks: HookDefinition[], _eventBus: EventBus) {
    this.hooks = hooks
    // Hooks are triggered by explicit hookRunner.run() calls from the REPL/engine.
    // Do NOT also subscribe to eventBus events — that would cause double-firing.
  }

  async run(event: string, toolName?: string, context?: Record<string, unknown>): Promise<HookResult[]> {
    const matching = this.hooks.filter(h => {
      if (h.event !== event) return false
      if (h.pattern && (!toolName || !matchPattern(h.pattern, toolName))) return false
      return true
    })
    const results: HookResult[] = []
    for (const hook of matching) {
      try {
        const result = await this.execute(hook.command, event, toolName, context)
        results.push(result)
        if (result.exitCode !== 0) logger.warn('Hook failed', { event, command: hook.command, exitCode: result.exitCode })
      } catch (e) {
        logger.error('Hook error', { event, command: hook.command, error: String(e) })
        results.push({ exitCode: 1, stdout: '', stderr: String(e) })
      }
    }
    return results
  }

  private async execute(command: string, event: string, toolName?: string, context?: Record<string, unknown>): Promise<HookResult> {
    const env: Record<string, string> = { ...process.env as Record<string, string>, HOOK_EVENT: event }
    if (toolName) env.HOOK_TOOL = toolName
    if (context) env.HOOK_CONTEXT = JSON.stringify(context)

    const proc = Bun.spawn(['bash', '-c', command], { env, stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => proc.kill(), 30000)
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    const exitCode = await proc.exited
    clearTimeout(timeout)
    return { exitCode, stdout, stderr }
  }
}

function matchPattern(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(value)
}
