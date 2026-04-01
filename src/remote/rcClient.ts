/**
 * Remote Control Client
 *
 * Connects autocli to eclaw-router's RC system:
 * 1. Creates an RC session on the server
 * 2. Displays QR code in terminal for browser access
 * 3. Polls for user input from the browser
 * 4. Pushes wire events (text, tool_call, tool_result, etc.) to the browser
 * 5. Handles approval requests from the browser
 */

import { theme } from '../ui/theme.js'
import type { Wire, WireEvent } from '../wire/wire.js'

export interface RCClientConfig {
  serverUrl: string    // e.g. 'https://router.eclaw.ai'
  apiKey: string       // sk-eclaw-xxx or JWT
}

interface RCSession {
  id: string
  url: string
}

export class RCClient {
  private config: RCClientConfig
  private session: RCSession | null = null
  private polling = false
  private pollAbort: AbortController | null = null
  private wireUnsubscribe: (() => void) | null = null

  constructor(config: RCClientConfig) {
    this.config = config
  }

  /** Create a session and display QR code. Returns session URL. */
  async start(): Promise<string> {
    const res = await fetch(`${this.config.serverUrl}/v1/rc/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Failed to create RC session: ${res.status} ${body}`)
    }

    const data = await res.json() as { session_id: string; url: string }
    this.session = { id: data.session_id, url: data.url }

    // Display QR code in terminal
    await this.showQRCode(data.url)

    console.log(theme.success('Remote control session started'))
    console.log(theme.dim(`Session: ${data.session_id}`))
    console.log(theme.info(`URL: ${data.url}`))
    console.log(theme.dim('Scan the QR code or open the URL in a browser'))
    console.log()

    return data.url
  }

  /** Subscribe to Wire events and forward them to the browser */
  connectWire(wire: Wire): void {
    if (!this.session) throw new Error('Session not started')

    const listener = (event: WireEvent) => {
      this.pushEvent(event.type, event.data)
    }

    wire.on('*', listener)
    this.wireUnsubscribe = () => wire.off('*', listener)
  }

  /** Start polling for user input from the browser. Returns an async iterator. */
  async *pollInput(): AsyncGenerator<{ type: string; message?: string; approved?: boolean }> {
    if (!this.session) throw new Error('Session not started')

    this.polling = true

    while (this.polling) {
      this.pollAbort = new AbortController()

      try {
        const res = await fetch(
          `${this.config.serverUrl}/v1/rc/sessions/${this.session.id}/poll`,
          {
            headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
            signal: this.pollAbort.signal,
          },
        )

        if (!res.ok) {
          if (res.status === 404) {
            // Session expired
            this.polling = false
            return
          }
          continue
        }

        const data = await res.json() as { type: string | null; message?: string; approved?: boolean }
        if (data.type) {
          yield data as { type: string; message?: string; approved?: boolean }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          continue
        }
        // Network error — brief pause then retry
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  /** Push an event to the browser via the server */
  async pushEvent(type: string, payload: unknown): Promise<void> {
    if (!this.session) return

    try {
      await fetch(
        `${this.config.serverUrl}/v1/rc/sessions/${this.session.id}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type, payload }),
        },
      )
    } catch {
      // Silently ignore push failures (browser may have disconnected)
    }
  }

  /** Stop polling and clean up the session */
  async stop(): Promise<void> {
    this.polling = false
    this.pollAbort?.abort()

    if (this.wireUnsubscribe) {
      this.wireUnsubscribe()
      this.wireUnsubscribe = null
    }

    if (this.session) {
      try {
        await fetch(
          `${this.config.serverUrl}/v1/rc/sessions/${this.session.id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
          },
        )
      } catch { /* ignore cleanup errors */ }
      this.session = null
    }
  }

  getSession(): RCSession | null {
    return this.session
  }

  isActive(): boolean {
    return this.session !== null && this.polling
  }

  private async showQRCode(url: string): Promise<void> {
    try {
      const qrcode = await import('qrcode-terminal')
      const generate = qrcode.default?.generate || qrcode.generate
      console.log()
      generate(url, { small: true }, (qr: string) => {
        console.log(qr)
      })
    } catch {
      // qrcode-terminal not available — just show the URL
      console.log(theme.warning('QR code display unavailable. Use the URL below:'))
    }
  }
}
