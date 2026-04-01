import { z } from 'zod'
import type { ToolDefinition } from './types.js'

export const webFetchTool: ToolDefinition = {
  name: 'WebFetch',
  description: 'Fetch a web page and extract its text content. Returns cleaned text for HTML pages, or raw text for other content types. Output is capped at 50KB.',
  inputSchema: z.object({
    url: z.string().describe('URL to fetch'),
    headers: z.record(z.string()).optional().describe('Optional extra headers'),
  }),
  isReadOnly: true,

  async call(input, _context) {
    const { url, headers: extraHeaders } = input as {
      url: string
      headers?: Record<string, string>
    }

    // Basic URL validation
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { output: `Error: Invalid URL: ${url}`, isError: true }
    }

    // Block private/internal IPs to prevent SSRF (IPv4 + IPv6)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '') // Strip brackets from IPv6
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === '::' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
      hostname.startsWith('169.254.') ||             // Link-local IPv4
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.startsWith('fc') || hostname.startsWith('fd') || // IPv6 ULA (fc00::/7)
      hostname.startsWith('fe80') ||                  // IPv6 link-local
      hostname.startsWith('::ffff:127.') ||           // IPv4-mapped IPv6 loopback
      hostname.startsWith('::ffff:10.') ||            // IPv4-mapped IPv6 private
      hostname.startsWith('::ffff:192.168.') ||       // IPv4-mapped IPv6 private
      hostname.match(/^::ffff:172\.(1[6-9]|2\d|3[01])\./) ||
      parsed.protocol === 'file:'
    ) {
      return { output: `Error: Fetching internal/private URLs is not allowed: ${url}`, isError: true }
    }

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'autocli/1.0',
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
      })

      if (!res.ok) {
        return { output: `HTTP ${res.status}: ${res.statusText}`, isError: true }
      }

      // Reject very large responses before loading into memory
      const contentLength = res.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > 100_000_000) {
        return { output: `Error: Response too large (${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)}MB). Max 100MB.`, isError: true }
      }

      const contentType = res.headers.get('content-type') || ''
      const text = await res.text()

      // HTML: strip scripts, styles, and tags to extract readable text
      if (contentType.includes('text/html')) {
        const cleaned = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()

        const maxLen = 50_000
        const output = cleaned.length > maxLen
          ? cleaned.slice(0, maxLen) + `\n\n[Content truncated: ${cleaned.length} chars total]`
          : cleaned

        return { output: `[Fetched ${url} (${contentType})]\n\n${output}` }
      }

      // JSON: pretty-print
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(text)
          const pretty = JSON.stringify(json, null, 2)
          const maxLen = 50_000
          const output = pretty.length > maxLen
            ? pretty.slice(0, maxLen) + `\n\n[JSON truncated: ${pretty.length} chars total]`
            : pretty
          return { output: `[Fetched ${url} (JSON)]\n\n${output}` }
        } catch {
          // Fall through to raw text
        }
      }

      // Other text: return raw, truncated
      const maxLen = 50_000
      const output = text.length > maxLen
        ? text.slice(0, maxLen) + `\n\n[Content truncated: ${text.length} chars total]`
        : text

      return { output: `[Fetched ${url} (${contentType || 'unknown'})]\n\n${output}` }
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('timeout') || message.includes('abort')) {
        return { output: `Error: Request timed out after 30s: ${url}`, isError: true }
      }
      return { output: `Error fetching ${url}: ${message}`, isError: true }
    }
  },
}
