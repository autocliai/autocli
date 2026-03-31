import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const fileWriteTool: ToolDefinition = {
  name: 'Write',
  description: 'Create or overwrite a file with the given content.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  isReadOnly: false,

  async call(input, _context) {
    const { file_path, content } = input as { file_path: string; content: string }

    try {
      mkdirSync(dirname(file_path), { recursive: true })
      writeFileSync(file_path, content)
      return { output: `Wrote ${content.split('\n').length} lines to ${file_path}` }
    } catch (err) {
      return { output: `Error writing file: ${(err as Error).message}`, isError: true }
    }
  },
}
