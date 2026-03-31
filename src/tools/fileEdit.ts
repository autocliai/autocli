import { readFileSync, writeFileSync, existsSync } from 'fs'
import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const fileEditTool: ToolDefinition = {
  name: 'Edit',
  description: 'Perform exact string replacement in a file. The old_string must match exactly.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    old_string: z.string().describe('Exact string to find'),
    new_string: z.string().describe('Replacement string'),
    replace_all: z.boolean().optional().describe('Replace all occurrences'),
  }),
  isReadOnly: false,

  async call(input, _context) {
    const { file_path, old_string, new_string, replace_all } = input as {
      file_path: string
      old_string: string
      new_string: string
      replace_all?: boolean
    }

    if (!existsSync(file_path)) {
      return { output: `Error: file not found: ${file_path}`, isError: true }
    }

    const content = readFileSync(file_path, 'utf-8')

    const count = content.split(old_string).length - 1
    if (count === 0) {
      return { output: `Error: old_string not found in ${file_path}`, isError: true }
    }
    if (count > 1 && !replace_all) {
      return {
        output: `Error: old_string found ${count} times. Use replace_all to replace all occurrences.`,
        isError: true,
      }
    }

    let newContent: string
    if (replace_all) {
      newContent = content.split(old_string).join(new_string)
    } else {
      const idx = content.indexOf(old_string)
      newContent = content.slice(0, idx) + new_string + content.slice(idx + old_string.length)
    }

    writeFileSync(file_path, newContent)
    return { output: `Edited ${file_path}: replaced ${count} occurrence(s)` }
  },
}
