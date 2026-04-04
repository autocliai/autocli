import { z } from 'zod'
import type { ToolDefinition, ToolResult } from './types.js'

export const webSearchTool: ToolDefinition = {
  name: 'WebSearch',
  description: 'Search the web using DuckDuckGo.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    max_results: z.number().optional().default(5).describe('Max results (1-20)'),
  }),
  isReadOnly: true,
  async call(input: unknown): Promise<ToolResult> {
    const { query, max_results = 5 } = input as { query: string; max_results?: number }
    const limit = Math.min(Math.max(max_results, 1), 20)
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const response = await fetch(url, { headers: { 'User-Agent': 'autocli/0.2' }, signal: AbortSignal.timeout(15000) })
      const html = await response.text()
      const results: { title: string; url: string; snippet: string }[] = []
      const resultPattern = /<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
      let match
      while ((match = resultPattern.exec(html)) && results.length < limit) {
        let rawUrl = match[1].replace(/&amp;/g, '&')
        const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/)
        if (uddgMatch) rawUrl = decodeURIComponent(uddgMatch[1])
        results.push({
          url: rawUrl,
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          snippet: match[3].replace(/<[^>]+>/g, '').trim(),
        })
      }
      if (results.length === 0) return { output: `No results found for: ${query}` }
      return { output: results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n') }
    } catch (e) { return { output: `Search error: ${String(e)}`, isError: true } }
  },
}
