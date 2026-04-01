import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const bashTool: ToolDefinition = {
  name: 'Bash',
  description: 'Execute a shell command. Use for: running tests, installing packages, git operations, and system commands. Do NOT use for file reading (use Read), file searching (use Glob/Grep), or file editing (use Edit).',
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default 120000)'),
    run_in_background: z.boolean().optional().describe('Run command in background and return immediately'),
  }),
  isReadOnly: false,

  async call(input, context) {
    const { command, timeout = 120_000, run_in_background } = input as {
      command: string
      timeout?: number
      run_in_background?: boolean
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
      /\|\s*(?:bash|sh|zsh)\b/,                         // pipe to shell
      /\beval\s+/,                                       // eval command
      /\bbash\s+-c\b/,                                    // bash -c invocation
      /\bsh\s+-c\b/,                                      // sh -c invocation
      /\$\(.*(?:rm|dd|mkfs|format)\b/,                  // command substitution with dangerous commands
    ]

    const isDangerous = DENY_PATTERNS.some(p => p.test(command))
    if (isDangerous) {
      return {
        output: `Blocked: This command matches a dangerous pattern and was not executed. If you need to run it, ask the user to execute it manually.`,
        isError: true,
      }
    }

    const sharedState = context.sharedState || {}
    const effectiveCwd = (sharedState.bashCwd as string) || context.workingDir

    // Background execution via BackgroundTaskManager
    if (run_in_background) {
      try {
        const { BackgroundTaskManager } = await import('../tasks/backgroundTask.js')
        // Use shared bgTaskManager or create one
        if (!context.sharedState) (context as { sharedState: Record<string, unknown> }).sharedState = {}
        if (!context.sharedState!.bgTaskManager) {
          context.sharedState!.bgTaskManager = new BackgroundTaskManager()
        }
        const mgr = context.sharedState!.bgTaskManager as InstanceType<typeof BackgroundTaskManager>
        const result = mgr.create(command, effectiveCwd)
        if ('error' in result) {
          return { output: result.error, isError: true }
        }
        return { output: `Background task started: ${result.id} (pid: ${result.pid})\nUse TaskList to check status.` }
      } catch (err) {
        return { output: `Failed to start background task: ${(err as Error).message}`, isError: true }
      }
    }

    // Use a unique marker unlikely to appear in normal output
    const cwdMarker = `___AUTOCLI_CWD_${Date.now()}_${Math.random().toString(36).slice(2)}___`

    try {
      // Append pwd tracking to capture directory changes.
      // Use pwd -P for canonical path to resolve symlinks consistently.
      const trackingCommand = `${command}\n__exit=$?\necho "${cwdMarker}$(pwd -P 2>/dev/null || pwd)"\nexit $__exit`

      // Use setsid so we can kill the entire process group on timeout
      const proc = Bun.spawn(['setsid', 'bash', '-c', trackingCommand], {
        cwd: effectiveCwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      })

      let timedOut = false
      let timeoutResolve: (() => void) | null = null
      const timeoutPromise = new Promise<void>((resolve) => { timeoutResolve = resolve })
      const timer = setTimeout(() => {
        timedOut = true
        try { proc.kill('SIGTERM') } catch {}
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 500)
        timeoutResolve?.()
      }, timeout)

      // Stream stdout incrementally so users see progress
      let stdout = ''
      let stderr = ''
      const stdoutReader = (async () => {
        const reader = proc.stdout.getReader()
        const decoder = new TextDecoder()
        let lineBuf = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            stdout += chunk
            // Stream complete lines via onProgress
            if (context.onProgress) {
              lineBuf += chunk
              const lines = lineBuf.split('\n')
              lineBuf = lines.pop() || ''
              for (const line of lines) {
                if (line && !line.includes(cwdMarker)) {
                  context.onProgress(line)
                }
              }
            }
          }
        } catch { /* stream closed on kill */ }
        // Flush remaining partial line
        if (context.onProgress && lineBuf && !lineBuf.includes(cwdMarker)) {
          context.onProgress(lineBuf)
        }
      })()
      const stderrReader = (async () => {
        const reader = proc.stderr.getReader()
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            stderr += decoder.decode(value, { stream: true })
          }
        } catch { /* stream closed on kill */ }
      })()

      // Race stream reading against timeout
      await Promise.race([
        Promise.all([stdoutReader, stderrReader]),
        timeoutPromise,
      ])

      clearTimeout(timer)

      if (timedOut) {
        return { output: `Command timed out after ${timeout}ms`, isError: true }
      }

      const exitCode = await proc.exited

      // Extract tracked cwd
      let userOutput = stdout
      const markerIdx = stdout.lastIndexOf(cwdMarker)
      if (markerIdx !== -1) {
        userOutput = stdout.slice(0, markerIdx)
        const newCwd = stdout.slice(markerIdx + cwdMarker.length).trim()
        if (newCwd) {
          sharedState.bashCwd = newCwd
        }
      }

      const output = (userOutput + (stderr ? '\n' + stderr : '')).trim()

      if (exitCode !== 0) {
        return { output: output || `Exit code: ${exitCode}`, isError: true }
      }

      return { output: output || '(no output)' }
    } catch (err) {
      return { output: `Error: ${(err as Error).message}`, isError: true }
    }
  },
}
