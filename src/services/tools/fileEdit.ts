import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'
import path from 'path'

export const fileEditTool: ToolDefinition = {
  name: 'Edit',
  description: 'Replace exact string occurrences in a file.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    old_string: z.string().describe('Exact string to find'),
    new_string: z.string().describe('Replacement string'),
    replace_all: z.boolean().optional().default(false).describe('Replace all occurrences'),
  }),
  isReadOnly: false,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { file_path, old_string, new_string, replace_all = false } = input as { file_path: string; old_string: string; new_string: string; replace_all?: boolean }
    const resolved = path.isAbsolute(file_path) ? file_path : path.join(ctx.workingDir, file_path)
    const file = Bun.file(resolved)
    if (!(await file.exists())) return { output: `Error: File not found: ${resolved}`, isError: true }
    let content = await file.text()
    if (!content.includes(old_string)) return { output: 'Error: old_string not found in file', isError: true }
    if (!replace_all) {
      const count = content.split(old_string).length - 1
      if (count > 1) return { output: `Error: old_string found ${count} times. Use replace_all or provide more context.`, isError: true }
    }
    content = replace_all ? content.replaceAll(old_string, new_string) : content.replace(old_string, new_string)
    await Bun.write(resolved, content)
    const oldLines = old_string.split('\n').map(l => `- ${l}`).join('\n')
    const newLines = new_string.split('\n').map(l => `+ ${l}`).join('\n')
    return { output: `${resolved}:\n${oldLines}\n${newLines}` }
  },
}
