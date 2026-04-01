import { describe, it, expect, beforeEach } from 'bun:test'
import { WsHandler } from './wsHandler.js'
import { RemoteAuth } from './auth.js'
import { ToolRegistry } from '../tools/registry.js'
import { TokenCounter } from '../engine/tokenCounter.js'
import { ContextManager } from '../engine/contextManager.js'
import type { QueryEngineConfig } from '../engine/queryEngine.js'

// Mock WebSocket that captures sent messages
class MockWebSocket {
  sent: string[] = []
  closed = false
  closeCode?: number
  closeReason?: string

  send(data: string) {
    this.sent.push(data)
  }

  close(code?: number, reason?: string) {
    this.closed = true
    this.closeCode = code
    this.closeReason = reason
  }

  lastMessage(): Record<string, unknown> | undefined {
    if (this.sent.length === 0) return undefined
    return JSON.parse(this.sent[this.sent.length - 1])
  }

  allMessages(): Record<string, unknown>[] {
    return this.sent.map(s => JSON.parse(s))
  }
}

const SECRET = 'test-secret-key'

function createHandler(): { handler: WsHandler; auth: RemoteAuth } {
  const auth = new RemoteAuth(SECRET)
  const toolRegistry = new ToolRegistry()
  const tokenCounter = new TokenCounter()
  const contextManager = new ContextManager()

  const config: QueryEngineConfig = {
    apiKey: 'test-key',
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    tokenCounter,
    contextManager,
    headless: true,
    permissionConfig: {
      mode: 'default' as const,
      rules: [],
      alwaysAllow: new Set<string>(),
    },
  }

  return { handler: new WsHandler(auth, config), auth }
}

function authToken(auth: RemoteAuth): string {
  return `Bearer ${auth.generateToken()}`
}

describe('WsHandler', () => {
  let handler: WsHandler
  let auth: RemoteAuth
  let ws: MockWebSocket

  beforeEach(() => {
    const created = createHandler()
    handler = created.handler
    auth = created.auth
    ws = new MockWebSocket()
  })

  describe('auth flow', () => {
    it('authenticates with valid token', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'auth', token: authToken(auth) }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('connected')
      expect(typeof msg.sessionId).toBe('string')
    })

    it('rejects invalid token', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'auth', token: 'Bearer invalid' }))
      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4001)
    })

    it('rejects chat before auth', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'chat', message: 'hello' }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('error')
      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4001)
    })

    it('allows ping without auth', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'ping' }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('pong')
      expect(ws.closed).toBe(false)
    })
  })

  describe('ping/pong', () => {
    it('responds to ping with pong', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'ping' }))
      expect(ws.lastMessage()!.type).toBe('pong')
    })
  })

  describe('error handling', () => {
    it('sends error for invalid JSON', () => {
      handler.onMessage(ws as any, 'not json')
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('error')
      expect(msg.message).toContain('Invalid JSON')
    })

    it('sends error for unknown message type', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'unknown' }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('error')
      expect(msg.message).toContain('Unknown message type')
    })
  })

  describe('control commands (after auth)', () => {
    beforeEach(() => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'auth', token: authToken(auth) }))
      ws.sent = [] // clear auth response
    })

    it('set_model sends ack with display name', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'control', action: 'set_model', value: 'sonnet' }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('control_ack')
      expect(msg.action).toBe('set_model')
      expect(msg.success).toBe(true)
      expect(typeof msg.value).toBe('string')
    })

    it('set_permission_mode sends ack', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'control', action: 'set_permission_mode', value: 'auto-approve' }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('control_ack')
      expect(msg.action).toBe('set_permission_mode')
      expect(msg.success).toBe(true)
      expect(msg.value).toBe('auto-approve')
    })

    it('set_max_tokens sends ack', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'control', action: 'set_max_tokens', value: 4096 }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('control_ack')
      expect(msg.action).toBe('set_max_tokens')
      expect(msg.success).toBe(true)
      expect(msg.value).toBe(4096)
    })

    it('interrupt with no query sends error ack', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'control', action: 'interrupt' }))
      const msg = ws.lastMessage()!
      expect(msg.type).toBe('control_ack')
      expect(msg.action).toBe('interrupt')
      expect(msg.success).toBe(false)
      expect(msg.error).toContain('No query')
    })
  })

  describe('session lifecycle', () => {
    it('creates session on auth', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'auth', token: authToken(auth) }))
      const session = handler.getSession(ws as any)
      expect(session).toBeDefined()
      expect(session!.authenticated).toBe(true)
      expect(session!.messages).toEqual([])
      expect(session!.queryInProgress).toBe(false)
    })

    it('cleans up session on close', () => {
      handler.onMessage(ws as any, JSON.stringify({ type: 'auth', token: authToken(auth) }))
      expect(handler.getSession(ws as any)).toBeDefined()
      handler.onClose(ws as any)
      expect(handler.getSession(ws as any)).toBeUndefined()
    })

    it('onClose does nothing for unknown ws', () => {
      // Should not throw
      handler.onClose(ws as any)
    })
  })
})
