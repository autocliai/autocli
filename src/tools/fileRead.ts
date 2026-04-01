import { readFileSync, existsSync, statSync } from 'fs'
import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const fileReadTool: ToolDefinition = {
  name: 'Read',
  description: 'Read a file from the filesystem. Returns contents with line numbers. Use this instead of cat/head/tail via Bash. Supports offset and limit for large files.',
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

    const ext = file_path.split('.').pop()?.toLowerCase() || ''

    // Image files — return base64 for multimodal models
    const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
    if (IMAGE_EXTS.includes(ext)) {
      try {
        const data = readFileSync(file_path)
        const base64 = data.toString('base64')
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        const sizeKb = Math.round(data.length / 1024)
        return {
          output: `[Image file: ${file_path} (${sizeKb}KB, ${mimeType})]\n\nBase64 data (${base64.length} chars) available. To analyze this image, the content has been encoded.\n\ndata:${mimeType};base64,${base64.slice(0, 200)}...`,
        }
      } catch (err) {
        return { output: `Error reading image: ${(err as Error).message}`, isError: true }
      }
    }

    // SVG — readable as text
    if (ext === 'svg') {
      // Fall through to text handling
    }

    // PDF files
    if (ext === 'pdf') {
      try {
        const data = readFileSync(file_path)
        const sizeKb = Math.round(data.length / 1024)
        return {
          output: `[PDF file: ${file_path} (${sizeKb}KB)]\n\nPDF content cannot be directly read as text. Use the Bash tool to extract text:\n  pdftotext "${file_path}" - | head -100`,
        }
      } catch (err) {
        return { output: `Error reading PDF: ${(err as Error).message}`, isError: true }
      }
    }

    // Binary file detection
    const BINARY_EXTS = ['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
      'exe', 'dll', 'so', 'dylib', 'o', 'a',
      'wasm', 'class', 'pyc', 'pyd',
      'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac',
      'ttf', 'otf', 'woff', 'woff2', 'eot',
      'ico', 'bmp', 'tiff', 'tif',
      'db', 'sqlite', 'sqlite3']
    if (BINARY_EXTS.includes(ext)) {
      const stat = statSync(file_path)
      const sizeKb = Math.round(stat.size / 1024)
      return {
        output: `[Binary file: ${file_path} (${sizeKb}KB, .${ext})]\n\nThis is a binary file and cannot be displayed as text.`,
      }
    }

    // Text files — existing behavior
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
