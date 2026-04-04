import type { ScheduleStore } from '../../stores/scheduleStore.js'
import type { JobResultStore, AgentResult } from '../../stores/jobResultStore.js'
import { logger } from '../../utils/logger.js'

const TICK_INTERVAL = 30000
const MAX_CONCURRENT = 3
const JOB_TIMEOUT = 30 * 60 * 1000

export class Scheduler {
  private scheduleStore: ScheduleStore
  private jobResultStore: JobResultStore
  private runTeamFn: (teamName: string, workingDir?: string) => Promise<AgentResult[]>
  private running = new Map<number, Promise<void>>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(scheduleStore: ScheduleStore, jobResultStore: JobResultStore, runTeamFn: (teamName: string, workingDir?: string) => Promise<AgentResult[]>) {
    this.scheduleStore = scheduleStore; this.jobResultStore = jobResultStore; this.runTeamFn = runTeamFn
  }

  start(): void { logger.info('Scheduler started'); this.timer = setInterval(() => this.tick().catch(e => logger.error('Scheduler tick error', { error: String(e) })), TICK_INTERVAL); this.tick().catch(e => logger.error('Scheduler tick error', { error: String(e) })) }
  stop(): void { if (this.timer) { clearInterval(this.timer); this.timer = null } }

  private async tick(): Promise<void> {
    if (this.running.size >= MAX_CONCURRENT) return
    for (const schedule of this.scheduleStore.getDue()) {
      if (this.running.size >= MAX_CONCURRENT) break
      if (this.running.has(schedule.id)) continue
      const job = this.runJob(schedule.id, schedule.teamName, schedule.workingDir)
      this.running.set(schedule.id, job)
      job.finally(() => this.running.delete(schedule.id))
    }
  }

  private async runJob(scheduleId: number, teamName: string, workingDir?: string): Promise<void> {
    const startedAt = new Date().toISOString()
    this.scheduleStore.markRun(scheduleId)
    try {
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null
      const agents = await Promise.race([
        this.runTeamFn(teamName, workingDir),
        new Promise<never>((_, reject) => { timeoutTimer = setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT) }),
      ]).finally(() => { if (timeoutTimer) clearTimeout(timeoutTimer) })
      this.jobResultStore.save({ scheduleId, teamName, status: agents.every(a => a.status === 'success') ? 'success' : 'partial', agents, startedAt, finishedAt: new Date().toISOString() })
    } catch (e) {
      this.jobResultStore.save({ scheduleId, teamName, status: 'failed', agents: [{ name: 'scheduler', status: 'failed', error: String(e) }], startedAt, finishedAt: new Date().toISOString() })
    }
  }
}
