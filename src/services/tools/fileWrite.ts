import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from './types.js'
import path from 'path'
import { mkdirSync } from 'fs'

const SECRETS_PATTERNS = ['.env', 'credentials', 'secret', 'apikey', 'api_key']

export const fileWriteTool: ToolDefinition = {
  name: 'Write',
  description: 'Create or overwrite a file.',
  inputSchema: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  isReadOnly: false,
  async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { file_path, content } = input as { file_path: string; content: string }
    const resolved = path.isAbsolute(file_path) ? file_path : path.join(ctx.workingDir, file_path)
    const basename = path.basename(resolved).toLowerCase()
    if (SECRETS_PATTERNS.some(p => basename.includes(p))) return { output: `Warning: Refusing to write potential secrets file: ${basename}`, isError: true }
    if (/(?:sk-|api[_-]?key|secret[_-]?key|password)\s*[:=]\s*['"]\S{10,}/i.test(content)) return { output: 'Warning: Content appears to contain API keys or secrets', isError: true }
    mkdirSync(path.dirname(resolved), { recursive: true })
    await Bun.write(resolved, content)
    return { output: `Wrote ${content.length} bytes to ${resolved}` }
  },
}
