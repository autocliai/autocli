import { readFileSync, existsSync } from 'fs'
import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const fileReadTool: ToolDefinition = {
  name: 'Read',
  description: 'Read a file from the filesystem. Returns contents with line numbers.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Line number to start from (1-based)'),
    limit: z.number().optional().describe('Max number of lines to read'),
  }),
  isReadOnly: true,

  async call(input, _context) {
    const { file_path, offset, limit } = input as {
      file_path: string
      offset?: number
      limit?: number
    }

    if (!existsSync(file_path)) {
      return { output: `Error: file not found: ${file_path}`, isError: true }
    }

    try {
      const content = readFileSync(file_path, 'utf-8')
      let lines = content.split('\n')

      const startLine = offset ? Math.max(1, offset) : 1
      const startIdx = startLine - 1

      if (limit) {
        lines = lines.slice(startIdx, startIdx + limit)
      } else if (offset) {
        lines = lines.slice(startIdx)
      }

      const gutterWidth = String(startLine + lines.length).length
      const numbered = lines.map((line, i) => {
        const num = String(startLine + i).padStart(gutterWidth)
        return `${num}\t${line}`
      })

      return { output: numbered.join('\n') }
    } catch (err) {
      return { output: `Error reading file: ${(err as Error).message}`, isError: true }
    }
  },
}
