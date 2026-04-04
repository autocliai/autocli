import { getDb } from './db.js'

export interface Message {
  role: 'user' | 'assistant' | 'tool_result'
  content: ContentBlock[]
}

export interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string
  [key: string]: unknown
}

export interface Session {
  id: string
  title?: string
  workingDir: string
  messages: Message[]
  totalCost: number
  totalTokens: { in: number; out: number }
  createdAt: string
  updatedAt: string
  model?: string
}

export interface SessionMetadata {
  id: string
  title?: string
  workingDir: string
  totalCost: number
  messageCount: number
  createdAt: string
  updatedAt: string
}

export class SessionStore {
  create(workingDir: string): Session {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const db = getDb()
    db.query(
      'INSERT INTO sessions (id, working_dir, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(id, workingDir, now, now)

    return {
      id, workingDir, messages: [],
      totalCost: 0, totalTokens: { in: 0, out: 0 },
      createdAt: now, updatedAt: now,
    }
  }

  save(session: Session): void {
    const db = getDb()
    const now = new Date().toISOString()
    const insert = db.query('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)')
    const transaction = db.transaction(() => {
      db.query(`UPDATE sessions SET title = ?, working_dir = ?, total_cost = ?, total_tokens_in = ?, total_tokens_out = ?, model = ?, updated_at = ? WHERE id = ?`).run(
        session.title || null, session.workingDir, session.totalCost,
        session.totalTokens.in, session.totalTokens.out, session.model || null, now, session.id,
      )
      db.query('DELETE FROM messages WHERE session_id = ?').run(session.id)
      for (const msg of session.messages) {
        insert.run(session.id, msg.role, JSON.stringify(msg.content), now)
      }
    })
    transaction()
  }

  load(id: string): Session | null {
    const db = getDb()
    const row = db.query('SELECT * FROM sessions WHERE id = ?').get(id) as any
    if (!row) return null
    const msgRows = db.query('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id').all(id) as { role: string; content: string }[]
    return {
      id: row.id, title: row.title || undefined, workingDir: row.working_dir,
      messages: msgRows.map(m => {
        let content: ContentBlock[]
        try { content = JSON.parse(m.content) } catch { content = [{ type: 'text', text: m.content }] }
        return { role: m.role as Message['role'], content }
      }),
      totalCost: row.total_cost, totalTokens: { in: row.total_tokens_in, out: row.total_tokens_out },
      createdAt: row.created_at, updatedAt: row.updated_at, model: row.model || undefined,
    }
  }

  list(): SessionMetadata[] {
    const db = getDb()
    const rows = db.query(`SELECT s.*, COUNT(m.id) as message_count FROM sessions s LEFT JOIN messages m ON m.session_id = s.id GROUP BY s.id ORDER BY s.updated_at DESC`).all() as any[]
    return rows.map(r => ({
      id: r.id, title: r.title || undefined, workingDir: r.working_dir,
      totalCost: r.total_cost, messageCount: r.message_count,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }))
  }

  getLatest(): Session | null {
    const db = getDb()
    const row = db.query('SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1').get() as any
    if (!row) return null
    return this.load(row.id)
  }
}
