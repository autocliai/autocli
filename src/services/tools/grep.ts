import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'

let rgAvailable: boolean | null = null

export const grepTool: ToolDefinition = {
  name: 'Grep',
  description: 'Search file contents using regex. Uses ripgrep if available.',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search'),
    path: z.string().optional().describe('File or directory to search'),
    include: z.string().optional().describe('File glob filter (e.g. "*.ts")'),
    max_results: z.number().optional().default(200).describe('Max matches'),
  }),
  isReadOnly: true,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { pattern, path: searchPath, include, max_results = 200 } = input as { pattern: string; path?: string; include?: string; max_results?: number }
    const dir = searchPath || ctx.workingDir
    const maxPerFile = Math.max(10, Math.min(max_results, 1000))
    const args = ['rg', '--no-heading', '--line-number', '--max-count', String(maxPerFile)]
    if (include) args.push('--glob', include)
    args.push(pattern, dir)
    if (rgAvailable === null) {
      rgAvailable = await (async () => { try { const p = Bun.spawn(['rg', '--version'], { stdout: 'pipe', stderr: 'pipe' }); await p.exited; return p.exitCode === 0 } catch { return false } })()
    }
    if (rgAvailable) {
      const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' })
      const stdout = await new Response(proc.stdout).text()
      await proc.exited
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n')
        let output = lines.slice(0, max_results).join('\n')
        if (lines.length > max_results) output += `\n... (${lines.length - max_results} more matches)`
        return { output }
      }
      return { output: 'No matches found' }
    } else {
      try {
        const grepArgs = ['grep', '-rn']
        if (include) grepArgs.push('--include', include)
        grepArgs.push(pattern, dir)
        const proc = Bun.spawn(grepArgs, { stdout: 'pipe', stderr: 'pipe' })
        const stdout = await new Response(proc.stdout).text()
        await proc.exited
        if (stdout.trim()) {
          const lines = stdout.trim().split('\n')
          let output = lines.slice(0, max_results).join('\n')
          if (lines.length > max_results) output += `\n... (${lines.length - max_results} more matches)`
          return { output }
        }
        return { output: 'No matches found' }
      } catch {
        return { output: 'Error: Neither ripgrep (rg) nor grep is available', isError: true }
      }
    }
  },
}
