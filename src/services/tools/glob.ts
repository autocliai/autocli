import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'

export const globTool: ToolDefinition = {
  name: 'Glob',
  description: 'Find files matching a glob pattern.',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern (e.g. "**/*.ts")'),
    path: z.string().optional().describe('Directory to search in'),
  }),
  isReadOnly: true,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { pattern, path: searchPath } = input as { pattern: string; path?: string }
    const dir = searchPath || ctx.workingDir
    const glob = new Bun.Glob(pattern)
    const matches: string[] = []
    const MAX = 1000
    for await (const match of glob.scan({ cwd: dir, absolute: true })) { matches.push(match); if (matches.length >= MAX) break }
    matches.sort()
    let output = matches.join('\n')
    if (matches.length >= MAX) output += `\n... (truncated at ${MAX} results)`
    if (matches.length === 0) output = `No files matched pattern: ${pattern}`
    return { output }
  },
}
