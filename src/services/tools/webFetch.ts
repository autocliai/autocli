import { z } from 'zod'
import type { ToolDefinition, ToolResult } from './types.js'

const PRIVATE_IP_RANGES = [/^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./, /^0\./, /^169\.254\./, /^::1$/, /^fd/i, /^fe80/i]

export const webFetchTool: ToolDefinition = {
  name: 'WebFetch',
  description: 'Fetch a URL and return its content.',
  inputSchema: z.object({
    url: z.string().describe('URL to fetch'),
    max_length: z.number().optional().default(50000).describe('Max content length'),
  }),
  isReadOnly: true,
  async call(input: unknown): Promise<ToolResult> {
    const { url, max_length = 50000 } = input as { url: string; max_length?: number }
    try {
      const parsed = new URL(url)
      for (const pattern of PRIVATE_IP_RANGES) { if (pattern.test(parsed.hostname)) return { output: 'Error: Blocked request to private IP range', isError: true } }
      if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) return { output: 'Error: Blocked request to localhost', isError: true }
    } catch { return { output: 'Error: Invalid URL', isError: true } }

    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'autocli/0.2' }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
      // Handle redirects manually to re-check target against SSRF blocklist
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (location) {
          try {
            const redirectUrl = new URL(location, url)
            for (const pattern of PRIVATE_IP_RANGES) { if (pattern.test(redirectUrl.hostname)) return { output: 'Error: Redirect to private IP range blocked', isError: true } }
            if (redirectUrl.hostname === 'localhost' || redirectUrl.hostname.endsWith('.local')) return { output: 'Error: Redirect to localhost blocked', isError: true }
            // Follow the redirect with same manual policy
            const redirectResponse = await fetch(redirectUrl.href, { headers: { 'User-Agent': 'autocli/0.2' }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
            if (!redirectResponse.ok && !(redirectResponse.status >= 300 && redirectResponse.status < 400)) return { output: `HTTP ${redirectResponse.status}: ${redirectResponse.statusText}`, isError: true }
            // Use redirect response (limit to one redirect for simplicity)
            const contentType = redirectResponse.headers.get('content-type') || ''
            let text = await redirectResponse.text()
            if (contentType.includes('html')) {
              text = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            }
            if (contentType.includes('json')) { try { text = JSON.stringify(JSON.parse(text), null, 2) } catch {} }
            if (text.length > max_length) text = text.slice(0, max_length) + '\n... (truncated)'
            return { output: text }
          } catch { return { output: 'Error: Invalid redirect URL', isError: true } }
        }
        return { output: `HTTP ${response.status}: Redirect with no location`, isError: true }
      }
      if (!response.ok) return { output: `HTTP ${response.status}: ${response.statusText}`, isError: true }
      const contentType = response.headers.get('content-type') || ''
      let text = await response.text()
      if (contentType.includes('html')) {
        text = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
      if (contentType.includes('json')) { try { text = JSON.stringify(JSON.parse(text), null, 2) } catch {} }
      if (text.length > max_length) text = text.slice(0, max_length) + '\n... (truncated)'
      return { output: text }
    } catch (e) { return { output: `Fetch error: ${String(e)}`, isError: true } }
  },
}
