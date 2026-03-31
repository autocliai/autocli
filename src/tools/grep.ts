import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const grepTool: ToolDefinition = {
  name: 'Grep',
  description: 'Search file contents using a regex pattern. Uses ripgrep if available, falls back to built-in.',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional().describe('File or directory to search'),
    glob: z.string().optional().describe('Glob to filter files (e.g. "*.ts")'),
    include_line_numbers: z.boolean().optional().describe('Show line numbers'),
  }),
  isReadOnly: true,

  async call(input, context) {
    const { pattern, path, glob: fileGlob, include_line_numbers } = input as {
      pattern: string
      path?: string
      glob?: string
      include_line_numbers?: boolean
    }
    const searchPath = path || context.workingDir

    try {
      const args = ['rg', '--no-heading']
      if (include_line_numbers !== false) args.push('-n')
      if (fileGlob) args.push('--glob', fileGlob)
      args.push('--max-count', '200')
      args.push(pattern, searchPath)

      const proc = Bun.spawn(args, {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      await proc.exited

      if (proc.exitCode === 1 && !stdout) {
        return { output: 'No matches found.' }
      }
      if (proc.exitCode !== 0 && proc.exitCode !== 1) {
        return await builtinGrep(pattern, searchPath, fileGlob)
      }

      return { output: stdout.trim() }
    } catch {
      return await builtinGrep(pattern, searchPath, fileGlob)
    }
  },
}

async function builtinGrep(
  pattern: string,
  searchPath: string,
  _fileGlob?: string,
): Promise<{ output: string; isError?: boolean }> {
  try {
    const proc = Bun.spawn(['grep', '-rn', '--include=*', pattern, searchPath], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    if (!stdout.trim()) return { output: 'No matches found.' }
    return { output: stdout.trim() }
  } catch (err) {
    return { output: `Error: ${(err as Error).message}`, isError: true }
  }
}
