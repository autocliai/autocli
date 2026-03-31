import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const bashTool: ToolDefinition = {
  name: 'Bash',
  description: 'Execute a shell command and return the output.',
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default 120000)'),
  }),
  isReadOnly: false,

  async call(input, context) {
    const { command, timeout = 120_000 } = input as {
      command: string
      timeout?: number
    }

    try {
      const proc = Bun.spawn(['bash', '-c', command], {
        cwd: context.workingDir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      })

      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill()
      }, timeout)

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])

      clearTimeout(timer)
      const exitCode = await proc.exited

      if (timedOut) {
        return { output: `Command timed out after ${timeout}ms`, isError: true }
      }

      const output = (stdout + (stderr ? '\n' + stderr : '')).trim()

      if (exitCode !== 0) {
        return { output: output || `Exit code: ${exitCode}`, isError: true }
      }

      return { output: output || '(no output)' }
    } catch (err) {
      return { output: `Error: ${(err as Error).message}`, isError: true }
    }
  },
}
