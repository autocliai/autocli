import { getDb } from './db.js'

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export interface Task {
  id: number
  subject: string
  description?: string
  status: TaskStatus
  activeForm?: string
  owner?: string
  blocks: number[]
  blockedBy: number[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface CreateTaskInput {
  subject: string
  description?: string
  activeForm?: string
  metadata?: Record<string, unknown>
}

export class TaskStore {
  create(input: CreateTaskInput): Task {
    const db = getDb()
    const now = new Date().toISOString()
    const result = db.query(
      `INSERT INTO tasks (subject, description, active_form, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(input.subject, input.description || null, input.activeForm || null, JSON.stringify(input.metadata || {}), now, now)
    return this.get(Number(result.lastInsertRowid))!
  }

  get(id: number): Task | null {
    const db = getDb()
    const row = db.query('SELECT * FROM tasks WHERE id = ?').get(id) as any
    if (!row) return null
    return this.rowToTask(row)
  }

  update(id: number, fields: Partial<Pick<Task, 'subject' | 'description' | 'status' | 'activeForm' | 'owner' | 'metadata'>>): void {
    const db = getDb()
    const sets: string[] = ['updated_at = datetime("now")']
    const values: unknown[] = []
    if (fields.subject !== undefined) { sets.push('subject = ?'); values.push(fields.subject) }
    if (fields.description !== undefined) { sets.push('description = ?'); values.push(fields.description) }
    if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status) }
    if (fields.activeForm !== undefined) { sets.push('active_form = ?'); values.push(fields.activeForm) }
    if (fields.owner !== undefined) { sets.push('owner = ?'); values.push(fields.owner) }
    if (fields.metadata !== undefined) { sets.push('metadata = ?'); values.push(JSON.stringify(fields.metadata)) }
    values.push(id)
    db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...(values as (string | number | null)[]))
  }

  delete(id: number): void {
    const db = getDb()
    db.query('DELETE FROM task_deps WHERE task_id = ? OR blocked_by = ?').run(id, id)
    db.query('DELETE FROM tasks WHERE id = ?').run(id)
  }

  list(): Task[] {
    const db = getDb()
    const rows = db.query('SELECT * FROM tasks ORDER BY id').all() as any[]
    return rows.map(r => this.rowToTask(r))
  }

  addBlock(taskId: number, blockedBy: number): void {
    const db = getDb()
    db.query('INSERT OR IGNORE INTO task_deps (task_id, blocked_by) VALUES (?, ?)').run(taskId, blockedBy)
  }

  private rowToTask(row: any): Task {
    const db = getDb()
    const blockedByRows = db.query('SELECT blocked_by FROM task_deps WHERE task_id = ?').all(row.id) as { blocked_by: number }[]
    const blocksRows = db.query('SELECT task_id FROM task_deps WHERE blocked_by = ?').all(row.id) as { task_id: number }[]
    return {
      id: row.id, subject: row.subject, description: row.description || undefined,
      status: row.status as TaskStatus, activeForm: row.active_form || undefined,
      owner: row.owner || undefined,
      blocks: blocksRows.map(r => r.task_id), blockedBy: blockedByRows.map(r => r.blocked_by),
      metadata: row.metadata ? (() => { try { return JSON.parse(row.metadata) } catch { return {} } })() : {},
      createdAt: row.created_at, updatedAt: row.updated_at,
    }
  }
}
