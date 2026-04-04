import { getDb } from './db.js'

export interface AgentResult {
  name: string
  status: 'success' | 'failed'
  result?: string
  error?: string
}

export interface JobResult {
  id: number
  scheduleId: number
  teamName: string
  status: 'success' | 'partial' | 'failed'
  agents: AgentResult[]
  startedAt: string
  finishedAt?: string
}

export class JobResultStore {
  save(input: Omit<JobResult, 'id'>): JobResult {
    const result = getDb().query(
      'INSERT INTO job_results (schedule_id, team_name, status, agents, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(input.scheduleId, input.teamName, input.status, JSON.stringify(input.agents), input.startedAt, input.finishedAt || null)
    return { ...input, id: Number(result.lastInsertRowid) }
  }

  get(id: number): JobResult | null {
    const row = getDb().query('SELECT * FROM job_results WHERE id = ?').get(id) as any
    if (!row) return null
    return this.rowToResult(row)
  }

  list(limit = 20): JobResult[] {
    return (getDb().query('SELECT * FROM job_results ORDER BY id DESC LIMIT ?').all(limit) as any[]).map(r => this.rowToResult(r))
  }

  getBySchedule(scheduleId: number, limit = 10): JobResult[] {
    return (getDb().query('SELECT * FROM job_results WHERE schedule_id = ? ORDER BY id DESC LIMIT ?').all(scheduleId, limit) as any[]).map(r => this.rowToResult(r))
  }

  private rowToResult(row: any): JobResult {
    return {
      id: row.id, scheduleId: row.schedule_id, teamName: row.team_name,
      status: row.status, agents: row.agents ? (() => { try { return JSON.parse(row.agents) } catch { return [] } })() : [],
      startedAt: row.started_at, finishedAt: row.finished_at || undefined,
    }
  }
}
