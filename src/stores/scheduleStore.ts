import { getDb } from './db.js'

export interface Schedule {
  id: number
  teamName: string
  interval: string
  enabled: boolean
  workingDir?: string
  nextRun?: string
  lastRun?: string
  createdAt: string
}

export class ScheduleStore {
  add(teamName: string, interval: string, workingDir?: string): Schedule {
    const db = getDb()
    const nextRun = new Date(Date.now() + parseInterval(interval)).toISOString()
    const result = db.query('INSERT INTO schedules (team_name, interval, working_dir, next_run) VALUES (?, ?, ?, ?)').run(teamName, interval, workingDir || null, nextRun)
    return this.get(Number(result.lastInsertRowid))!
  }

  get(id: number): Schedule | null {
    const row = getDb().query('SELECT * FROM schedules WHERE id = ?').get(id) as any
    if (!row) return null
    return this.rowToSchedule(row)
  }

  list(): Schedule[] {
    return (getDb().query('SELECT * FROM schedules ORDER BY id').all() as any[]).map(r => this.rowToSchedule(r))
  }

  remove(id: number): void { getDb().query('DELETE FROM schedules WHERE id = ?').run(id) }
  enable(id: number): void { getDb().query('UPDATE schedules SET enabled = 1 WHERE id = ?').run(id) }
  disable(id: number): void { getDb().query('UPDATE schedules SET enabled = 0 WHERE id = ?').run(id) }

  markRun(id: number): void {
    const schedule = this.get(id)
    if (!schedule) return
    const now = new Date().toISOString()
    const next = new Date(Date.now() + parseInterval(schedule.interval)).toISOString()
    getDb().query('UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?').run(now, next, id)
  }

  getDue(): Schedule[] {
    const now = new Date().toISOString()
    return (getDb().query('SELECT * FROM schedules WHERE enabled = 1 AND (next_run IS NULL OR next_run <= ?)').all(now) as any[]).map(r => this.rowToSchedule(r))
  }

  private rowToSchedule(row: any): Schedule {
    return {
      id: row.id, teamName: row.team_name, interval: row.interval,
      enabled: !!row.enabled, workingDir: row.working_dir || undefined,
      nextRun: row.next_run || undefined, lastRun: row.last_run || undefined,
      createdAt: row.created_at,
    }
  }
}

export function parseInterval(str: string): number {
  let ms = 0
  const patterns: [RegExp, number][] = [
    [/(\d+)\s*d(?![\w])/i, 86400000], [/(\d+)\s*h(?![\w])/i, 3600000],
    [/(\d+)\s*m(?!s)(?![\w])/i, 60000], [/(\d+)\s*s(?![\w])/i, 1000],
  ]
  for (const [re, mult] of patterns) {
    const m = str.match(re)
    if (m) ms += parseInt(m[1]) * mult
  }
  if (ms === 0) ms = parseInt(str) || 3600000
  return ms
}

export function formatInterval(ms: number): string {
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  return parts.join(' ') || '0m'
}
