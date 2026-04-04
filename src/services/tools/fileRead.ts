import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'
import path from 'path'

export const fileReadTool: ToolDefinition = {
  name: 'Read',
  description: 'Read a file from the filesystem. Returns content with line numbers.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Line number to start from (0-based)'),
    limit: z.number().optional().describe('Max lines to read'),
  }),
  isReadOnly: true,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { file_path, offset = 0, limit = 2000 } = input as { file_path: string; offset?: number; limit?: number }
    const resolved = path.isAbsolute(file_path) ? file_path : path.join(ctx.workingDir, file_path)
    const file = Bun.file(resolved)
    if (!(await file.exists())) return { output: `Error: File not found: ${resolved}`, isError: true }
    const ext = path.extname(resolved).toLowerCase()
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']
    if (imageExts.includes(ext)) {
      const bytes = await file.arrayBuffer()
      return { output: `[Image file: ${ext}, ${bytes.byteLength} bytes]` }
    }
    const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.o', '.a', '.bin', '.zip', '.tar', '.gz']
    if (binaryExts.includes(ext)) return { output: `[Binary file: ${ext}, ${file.size} bytes]` }
    const text = await file.text()
    const lines = text.split('\n')
    const sliced = lines.slice(offset, offset + limit)
    const numbered = sliced.map((line, i) => `${offset + i + 1}\t${line}`)
    let output = numbered.join('\n')
    const totalLines = text.endsWith('\n') ? lines.length - 1 : lines.length
    if (offset + limit < totalLines) output += `\n... (${totalLines - offset - limit} more lines)`
    return { output }
  },
}
