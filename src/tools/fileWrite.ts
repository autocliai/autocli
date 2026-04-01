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

    // Warn about potential secrets files
    const SECRETS_PATTERNS = ['.env', '.env.local', '.env.production', 'credentials', 'secret', '.pem', '.key', 'id_rsa', 'id_ed25519']
    const basename = file_path.split('/').pop() || ''
    const isSecrets = SECRETS_PATTERNS.some(p => basename.includes(p))
    if (isSecrets) {
      return {
        output: `Warning: "${basename}" looks like a secrets file. Writing to it could expose sensitive data. If you're sure, use the Bash tool: echo '...' > "${file_path}"`,
        isError: true,
      }
    }

    // Check content for exposed secrets
    const SECRET_CONTENT_PATTERNS = [
      /(?:api[_-]?key|secret[_-]?key|access[_-]?token|password)\s*[:=]\s*['"]\S{10,}/i,
      /sk-[a-zA-Z0-9]{20,}/,           // OpenAI/Anthropic keys
      /ghp_[a-zA-Z0-9]{36}/,           // GitHub personal tokens
      /AKIA[0-9A-Z]{16}/,              // AWS access keys
    ]
    const hasSecrets = SECRET_CONTENT_PATTERNS.some(p => p.test(content))
    if (hasSecrets) {
      return {
        output: `Warning: Content appears to contain API keys or secrets. Refusing to write to prevent accidental exposure.`,
        isError: true,
      }
    }

    try {
      mkdirSync(dirname(file_path), { recursive: true })
      writeFileSync(file_path, content)
      return { output: `Wrote ${content.split('\n').length} lines to ${file_path}` }
    } catch (err) {
      return { output: `Error writing file: ${(err as Error).message}`, isError: true }
    }
  },
}
