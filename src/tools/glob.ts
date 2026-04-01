import { z } from 'zod'
import { Glob } from 'bun'
import type { ToolDefinition } from './types.js'

export const globTool: ToolDefinition = {
  name: 'Glob',
  description: 'Find files matching a glob pattern. Use instead of find/ls via Bash. Example patterns: "**/*.ts", "src/**/*.test.ts".',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern (e.g. "**/*.ts")'),
    path: z.string().optional().describe('Directory to search in'),
  }),
  isReadOnly: true,

  async call(input, context) {
    const { pattern, path } = input as { pattern: string; path?: string }
    const searchDir = path || context.workingDir

    try {
      const glob = new Glob(pattern)
      const matches: string[] = []

      for await (const file of glob.scan({ cwd: searchDir, absolute: false })) {
        matches.push(file)
        if (matches.length >= 1000) break
      }

      matches.sort()

      if (matches.length === 0) {
        return { output: 'No files matched the pattern.' }
      }

      return { output: matches.join('\n') }
    } catch (err) {
      return { output: `Error: ${(err as Error).message}`, isError: true }
    }
  },
}
