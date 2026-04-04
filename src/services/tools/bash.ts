import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'

const DANGEROUS_PATTERNS = [
  /(?:sudo\s+)?rm\s+-\w*r\w*f\w*\s+[\/~]/, />\s*\/dev\/sd/, /mkfs\./, /dd\s+if=.*of=\/dev/,
  /(?:sudo\s+)?chmod\s+777\s+\//, /git\s+push\s+.*--force/, /git\s+reset\s+--hard/,
  /curl\s+.*\|\s*(bash|sh|zsh)/, /wget\s+.*\|\s*(bash|sh|zsh)/, /\beval\b.*\$/,
]

export const bashTool: ToolDefinition = {
  name: 'Bash',
  description: 'Execute a shell command.',
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (max 600000)'),
    run_in_background: z.boolean().optional().describe('Run in background'),
  }),
  isReadOnly: false,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { command, timeout = 120000, run_in_background = false } = input as { command: string; timeout?: number; run_in_background?: boolean }
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) return { output: `Error: Blocked dangerous command: ${command}`, isError: true }
    }
    const effectiveTimeout = Math.min(timeout, 600000)
    const wrappedCommand = `${command}; echo "___CWD___:$(pwd)"`

    if (run_in_background) {
      const bgManager = ctx.sharedState.backgroundTaskManager as any
      if (bgManager) { const taskId = await bgManager.spawn(command, ctx.workingDir); return { output: `Background task started: ${taskId}` } }
      return { output: 'Error: Background task manager not available', isError: true }
    }

    const proc = Bun.spawn(['bash', '-c', wrappedCommand], { cwd: ctx.workingDir, stdout: 'pipe', stderr: 'pipe', env: process.env as Record<string, string> })
    let killTimer: ReturnType<typeof setTimeout> | null = null
    const timer = setTimeout(() => { try { proc.kill('SIGTERM') } catch {} killTimer = setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000) }, effectiveTimeout)
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    const exitCode = await proc.exited
    clearTimeout(timer)
    if (killTimer) clearTimeout(killTimer)

    const lines = stdout.split('\n')
    const cwdIdx = lines.findLastIndex(l => l.startsWith('___CWD___:'))
    if (cwdIdx >= 0) { const newCwd = lines[cwdIdx].slice('___CWD___:'.length); ctx.workingDir = newCwd; ctx.sharedState.workingDir = newCwd; lines.splice(cwdIdx, 1) }
    const output = lines.join('\n').trim()
    const combined = stderr ? `${output}\n${stderr}`.trim() : output
    const maxOutput = 100 * 1024
    const capped = combined.length > maxOutput ? combined.slice(0, maxOutput) + '\n... (output truncated)' : combined
    if (exitCode !== 0) return { output: capped || `Command exited with code ${exitCode}`, isError: true }
    return { output: capped }
  },
}
