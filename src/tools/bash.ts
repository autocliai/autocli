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

    // Dangerous command patterns
    const DENY_PATTERNS = [
      /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(?!\w)/, // rm -rf / or rm -f /
      /\bgit\s+push\s+.*--force\s+.*(?:main|master)/i, // force push to main
      /\bgit\s+reset\s+--hard\b/,                      // git reset --hard
      /\bgit\s+clean\s+-[a-zA-Z]*f/,                   // git clean -f
      /\bchmod\s+777\b/,                                // chmod 777
      /\bcurl\s+.*\|\s*(?:bash|sh)\b/,                  // curl | bash
      /\bdd\s+.*of=\/dev\/[sh]d/,                       // dd to raw device
      /\bmkfs\b/,                                        // format filesystem
      /\b:(){ :\|:& };:\b/,                             // fork bomb
    ]

    const isDangerous = DENY_PATTERNS.some(p => p.test(command))
    if (isDangerous) {
      return {
        output: `Blocked: This command matches a dangerous pattern and was not executed. If you need to run it, ask the user to execute it manually.`,
        isError: true,
      }
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
