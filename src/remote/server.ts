import { RemoteAuth } from './auth.js'
import { getServerStatus } from './status.js'
import type { TokenCounter } from '../engine/tokenCounter.js'
import { QueryEngine, type QueryEngineConfig } from '../engine/queryEngine.js'
import type { Message } from '../commands/types.js'
import { theme } from '../ui/theme.js'
import type { OpenAIMessage } from '../providers/openai.js'

interface RemoteSession {
  id: string
  messages: Message[]
  createdAt: number
}

export class RemoteServer {
  private auth: RemoteAuth
  private sessions = new Map<string, RemoteSession>()
  private startTime = Date.now()
  private server: ReturnType<typeof Bun.serve> | null = null
  private engine: QueryEngine
  private engineConfig: QueryEngineConfig
  private tokenCounter: TokenCounter
  private pendingApprovals = new Map<string, {
    resolve: (approved: boolean) => void
    toolName: string
    input: Record<string, unknown>
  }>()

  constructor(
    engine: QueryEngine,
    engineConfig: QueryEngineConfig,
    tokenCounter: TokenCounter,
    secret: string,
    apiKey?: string,
  ) {
    this.engine = engine
    this.engineConfig = engineConfig
    this.tokenCounter = tokenCounter
    this.auth = new RemoteAuth(secret, apiKey)
  }

  start(port: number): void {
    const self = this

    this.server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url)

        // Auth check (skip for health)
        if (url.pathname !== '/health') {
          const authHeader = req.headers.get('Authorization')
          if (!authHeader || !self.auth.authenticateHeader(authHeader)) {
            return new Response('Unauthorized', { status: 401 })
          }
        }

        // Routes
        switch (url.pathname) {
          case '/health':
            return Response.json({ status: 'ok' })

          case '/status':
            return Response.json(getServerStatus(
              self.startTime,
              self.sessions.size,
              self.tokenCounter,
            ))

          case '/token':
            return Response.json({ token: self.auth.generateToken() })

          case '/sessions':
            if (req.method === 'GET') {
              const list = Array.from(self.sessions.values()).map(s => ({
                id: s.id,
                messageCount: s.messages.length,
                createdAt: s.createdAt,
              }))
              return Response.json(list)
            }
            if (req.method === 'POST') {
              const id = crypto.randomUUID().slice(0, 8)
              self.sessions.set(id, { id, messages: [], createdAt: Date.now() })
              return Response.json({ id })
            }
            return new Response('Method not allowed', { status: 405 })

          case '/chat': {
            if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
            let body: { sessionId?: string; message: string; workingDir?: string }
            try {
              body = await req.json() as typeof body
            } catch {
              return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
            }
            if (!body.message || typeof body.message !== 'string') {
              return Response.json({ error: 'Missing required field: message' }, { status: 400 })
            }
            const sessionId = body.sessionId || crypto.randomUUID().slice(0, 8)

            let session = self.sessions.get(sessionId)
            if (!session) {
              session = { id: sessionId, messages: [], createdAt: Date.now() }
              self.sessions.set(sessionId, session)
            }

            session.messages.push({ role: 'user', content: body.message })

            const { response, messages } = await self.engine.run(
              session.messages,
              body.workingDir || process.cwd(),
            )

            session.messages = messages

            const textContent = typeof response.content === 'string'
              ? response.content
              : response.content
                  .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                  .map(b => b.text)
                  .join('\n')

            // Include tool usage info for transparency
            const toolCalls = typeof response.content === 'string'
              ? []
              : response.content
                  .filter(b => b.type === 'tool_use')
                  .map(b => ({ name: (b as { name: string }).name, id: (b as { id: string }).id }))

            return Response.json({
              sessionId,
              response: textContent,
              toolCalls,
              usage: {
                input: self.tokenCounter.totalInput,
                output: self.tokenCounter.totalOutput,
                cost: self.tokenCounter.formatCost(),
              },
            })
          }

          case '/chat/stream': {
            if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
            let body: { sessionId?: string; message: string; workingDir?: string }
            try {
              body = await req.json() as typeof body
            } catch {
              return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
            }
            if (!body.message || typeof body.message !== 'string') {
              return Response.json({ error: 'Missing required field: message' }, { status: 400 })
            }

            const encoder = new TextEncoder()
            const stream = new ReadableStream({
              async start(controller) {
                const sessionId = body.sessionId || crypto.randomUUID().slice(0, 8)
                let session = self.sessions.get(sessionId)
                if (!session) {
                  session = { id: sessionId, messages: [], createdAt: Date.now() }
                  self.sessions.set(sessionId, session)
                }

                session.messages.push({ role: 'user', content: body.message })

                const sendEvent = (event: string, data: unknown) => {
                  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
                }

                try {
                  // Create engine with SSE callbacks for real-time streaming
                  const streamEngine = new QueryEngine({
                    ...self.engineConfig,
                    onText: (text: string) => sendEvent('text', { text }),
                    onToolUse: (name: string, input: Record<string, unknown>) => sendEvent('tool_use', { name, input }),
                    onToolResult: (name: string, result) => sendEvent('tool_result', { name, output: result.output, isError: result.isError }),
                  })
                  const { messages } = await streamEngine.run(
                    session!.messages,
                    body.workingDir || process.cwd(),
                  )
                  session!.messages = messages
                  sendEvent('done', { sessionId })
                } catch (err) {
                  sendEvent('error', { message: (err as Error).message })
                }

                controller.close()
              },
            })

            return new Response(stream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            })
          }

          case '/approvals': {
            if (req.method === 'GET') {
              const pending = Array.from(self.pendingApprovals.entries()).map(([id, a]) => ({
                id,
                toolName: a.toolName,
                input: a.input,
              }))
              return Response.json(pending)
            }
            if (req.method === 'POST') {
              const body = await req.json() as { id: string; approved: boolean }
              const approval = self.pendingApprovals.get(body.id)
              if (approval) {
                approval.resolve(body.approved)
                self.pendingApprovals.delete(body.id)
                return Response.json({ ok: true })
              }
              return Response.json({ error: 'Approval not found' }, { status: 404 })
            }
            return new Response('Method not allowed', { status: 405 })
          }

          default:
            return new Response('Not found', { status: 404 })
        }
      },
    })

    console.log(theme.success(`Remote server started on port ${port}`))
  }

  stop(): void {
    this.server?.stop()
  }

  async requestRemoteApproval(toolName: string, input: Record<string, unknown>): Promise<boolean> {
    const id = crypto.randomUUID().slice(0, 8)
    return new Promise((resolve) => {
      this.pendingApprovals.set(id, { resolve, toolName, input })
      setTimeout(() => {
        if (this.pendingApprovals.has(id)) {
          this.pendingApprovals.delete(id)
          resolve(false)
        }
      }, 300_000)
    })
  }
}
