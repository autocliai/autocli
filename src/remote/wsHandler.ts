import type { ServerWebSocket } from 'bun'
import { RemoteAuth } from './auth.js'
import { QueryEngine, type QueryEngineConfig } from '../engine/queryEngine.js'
import { TokenCounter } from '../engine/tokenCounter.js'
import { ContextManager } from '../engine/contextManager.js'
import { SessionStore } from '../session/sessionStore.js'
import { resolveModel, modelDisplayName } from '../utils/config.js'
import { logger } from '../utils/logger.js'
import type { Message } from '../commands/types.js'
import type { ServerMessage } from './wsProtocol.js'
import { parseClientMessage } from './wsProtocol.js'

export interface WsSession {
  id: string
  messages: Message[]
  abortController: AbortController | null
  engine: QueryEngine
  tokenCounter: TokenCounter
  authenticated: boolean
  queryInProgress: boolean
  lastActivityAt: number
}

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes idle timeout
const SESSION_CLEANUP_INTERVAL_MS = 60 * 1000 // check every minute
const MAX_REQUESTS_PER_MINUTE = 60

export class WsHandler {
  private auth: RemoteAuth
  private baseConfig: QueryEngineConfig
  private sessions = new Map<ServerWebSocket<unknown>, WsSession>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private rateLimitMap = new Map<ServerWebSocket<unknown>, { count: number; windowStart: number }>()
  private sessionStore: SessionStore | null = null

  constructor(auth: RemoteAuth, baseConfig: QueryEngineConfig, sessionStore?: SessionStore) {
    this.auth = auth
    this.baseConfig = baseConfig
    this.sessionStore = sessionStore || null

    // Start periodic cleanup of idle sessions
    this.cleanupTimer = setInterval(() => this.cleanupIdleSessions(), SESSION_CLEANUP_INTERVAL_MS)
  }

  /** Stop the cleanup timer (call on server shutdown) */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  private cleanupIdleSessions(): void {
    const now = Date.now()
    for (const [ws, session] of this.sessions) {
      if (!session.queryInProgress && (now - session.lastActivityAt) > SESSION_TTL_MS) {
        session.abortController?.abort()
        this.sessions.delete(ws)
        this.rateLimitMap.delete(ws)
        try { ws.close(4008, 'Session idle timeout') } catch { /* already closed */ }
      }
    }
  }

  private checkRateLimit(ws: ServerWebSocket<unknown>): boolean {
    const now = Date.now()
    let entry = this.rateLimitMap.get(ws)
    if (!entry || (now - entry.windowStart) > 60_000) {
      entry = { count: 0, windowStart: now }
      this.rateLimitMap.set(ws, entry)
    }
    entry.count++
    return entry.count <= MAX_REQUESTS_PER_MINUTE
  }

  onOpen(ws: ServerWebSocket<unknown>): void {
    // Connection opened — wait for auth message
  }

  onMessage(ws: ServerWebSocket<unknown>, raw: string | Buffer): void {
    const str = typeof raw === 'string' ? raw : raw.toString()
    const result = parseClientMessage(str)

    if (!result.ok) {
      this.send(ws, { type: 'error', message: result.error })
      return
    }

    const msg = result.msg
    const session = this.sessions.get(ws)

    // Auth must be first message
    if (msg.type !== 'auth' && msg.type !== 'ping' && !session?.authenticated) {
      this.send(ws, { type: 'error', message: 'Not authenticated. Send auth message first.' })
      ws.close(4001, 'Not authenticated')
      return
    }

    // Rate limiting
    if (msg.type !== 'ping' && !this.checkRateLimit(ws)) {
      this.send(ws, { type: 'error', message: 'Rate limit exceeded. Max 60 requests per minute.' })
      return
    }

    // Update activity timestamp
    if (session) session.lastActivityAt = Date.now()

    switch (msg.type) {
      case 'auth':
        this.handleAuth(ws, msg.token)
        break
      case 'chat':
        this.handleChat(ws, msg.message, msg.sessionId, msg.workingDir)
        break
      case 'control':
        this.handleControl(ws, msg.action, msg.value)
        break
      case 'ping':
        this.send(ws, { type: 'pong' })
        break
    }
  }

  onClose(ws: ServerWebSocket<unknown>): void {
    const session = this.sessions.get(ws)
    if (session) {
      // Abort any running query
      session.abortController?.abort()
      this.sessions.delete(ws)
      this.rateLimitMap.delete(ws)
    }
  }

  getSession(ws: ServerWebSocket<unknown>): WsSession | undefined {
    return this.sessions.get(ws)
  }

  // ── Auth ──

  private handleAuth(ws: ServerWebSocket<unknown>, token: string): void {
    if (!this.auth.authenticateHeader(token)) {
      this.send(ws, { type: 'error', message: 'Authentication failed' })
      ws.close(4001, 'Authentication failed')
      return
    }

    const id = crypto.randomUUID().slice(0, 8)
    const tokenCounter = new TokenCounter(this.baseConfig.model)
    const contextManager = new ContextManager()

    const sessionConfig: QueryEngineConfig = {
      ...this.baseConfig,
      tokenCounter,
      contextManager,
      headless: true,
    }

    const engine = new QueryEngine(sessionConfig)

    const session: WsSession = {
      id,
      messages: [],
      abortController: null,
      engine,
      tokenCounter,
      authenticated: true,
      queryInProgress: false,
      lastActivityAt: Date.now(),
    }

    this.sessions.set(ws, session)
    this.send(ws, { type: 'connected', sessionId: id })
  }

  // ── Chat ──

  private handleChat(ws: ServerWebSocket<unknown>, message: string, sessionId?: string, workingDir?: string): void {
    const session = this.sessions.get(ws)!

    if (session.queryInProgress) {
      this.send(ws, { type: 'error', message: 'Query already in progress. Send interrupt first.' })
      return
    }

    // Restore messages from a previous session if provided
    if (sessionId && sessionId !== session.id) {
      session.id = sessionId
      // Actually load messages from persisted session
      if (this.sessionStore) {
        const saved = this.sessionStore.load(sessionId)
        if (saved && saved.messages.length > 0) {
          session.messages = saved.messages
        }
      }
    }

    session.messages.push({ role: 'user', content: message })
    session.queryInProgress = true

    const abortController = new AbortController()
    session.abortController = abortController

    // Configure streaming callbacks on the engine config
    const config = session.engine.getConfigSnapshot()
    config.onText = (text: string) => {
      if (!abortController.signal.aborted) {
        this.send(ws, { type: 'text', text })
      }
    }
    config.onToolUse = (name: string, input: Record<string, unknown>) => {
      if (!abortController.signal.aborted) {
        this.send(ws, { type: 'tool_use', name, input })
      }
    }
    config.onToolResult = (name: string, result) => {
      if (!abortController.signal.aborted) {
        this.send(ws, { type: 'tool_result', name, output: result.output, isError: result.isError || false })
      }
    }

    // Create a fresh engine with streaming callbacks for this query
    const queryEngine = new QueryEngine(config)

    const cwd = workingDir || process.cwd()

    // Query timeout (5 minutes max)
    const queryTimeout = setTimeout(() => {
      if (!abortController.signal.aborted) {
        abortController.abort()
      }
    }, 5 * 60 * 1000)

    // Run query asynchronously
    queryEngine.run(session.messages, cwd, abortController.signal)
      .then(({ messages }) => {
        session.messages = messages

        if (abortController.signal.aborted) {
          this.send(ws, { type: 'interrupted' })
        } else {
          this.send(ws, {
            type: 'done',
            sessionId: session.id,
            usage: {
              input: session.tokenCounter.totalInput,
              output: session.tokenCounter.totalOutput,
              cost: session.tokenCounter.formatCost(),
            },
          })
        }
      })
      .catch((err) => {
        if (abortController.signal.aborted) {
          this.send(ws, { type: 'interrupted' })
        } else {
          this.send(ws, { type: 'error', message: (err as Error).message || 'Query failed' })
        }
      })
      .finally(() => {
        clearTimeout(queryTimeout)
        session.abortController = null
        session.queryInProgress = false
        session.lastActivityAt = Date.now()
      })
  }

  // ── Control ──

  private handleControl(ws: ServerWebSocket<unknown>, action: string, value?: string | number): void {
    const session = this.sessions.get(ws)!

    switch (action) {
      case 'interrupt': {
        if (session.abortController) {
          session.abortController.abort()
          this.send(ws, { type: 'control_ack', action, success: true })
        } else {
          this.send(ws, { type: 'control_ack', action, success: false, error: 'No query in progress' })
        }
        break
      }

      case 'set_model': {
        const model = resolveModel(value as string, this.baseConfig.model)
        session.engine.setModel(model)
        session.tokenCounter.updateModel(model)
        const display = modelDisplayName(model)
        this.send(ws, { type: 'control_ack', action, success: true, value: display })
        break
      }

      case 'set_permission_mode': {
        const mode = value as 'default' | 'auto-approve' | 'deny-all'
        session.engine.setPermissionMode(mode)
        this.send(ws, { type: 'control_ack', action, success: true, value: mode })
        break
      }

      case 'set_max_tokens': {
        const tokens = value as number
        session.engine.setMaxTokens(tokens)
        this.send(ws, { type: 'control_ack', action, success: true, value: tokens })
        break
      }
    }
  }

  // ── Helpers ──

  private send(ws: ServerWebSocket<unknown>, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch (err) {
      // Connection closed — clean up session
      logger.debug('WebSocket send failed, cleaning up session', { error: (err as Error).message })
      if (this.sessions.has(ws)) {
        const session = this.sessions.get(ws)
        session?.abortController?.abort()
        this.sessions.delete(ws)
        this.rateLimitMap.delete(ws)
      }
    }
  }
}
