import { ScheduleStore, formatInterval } from './scheduleStore.js'
import { AgentStore } from '../agents/agentStore.js'
import type { TeamTemplate } from '../agents/types.js'
import { theme } from '../ui/theme.js'
import { getLayout } from '../ui/fullscreen.js'

export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private scheduleStore: ScheduleStore
  private agentStore: AgentStore
  private runTeamFn: (template: TeamTemplate, workingDir: string) => Promise<void>
  private runningTeams = new Set<string>()
  private maxConcurrent = 3

  constructor(
    scheduleStore: ScheduleStore,
    agentStore: AgentStore,
    runTeamFn: (template: TeamTemplate, workingDir: string) => Promise<void>,
  ) {
    this.scheduleStore = scheduleStore
    this.agentStore = agentStore
    this.runTeamFn = runTeamFn
  }

  /** Start the background scheduler loop (checks every 30s) */
  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => this.tick(), 30_000)
    process.on('exit', () => this.stop())
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    const due = this.scheduleStore.getDue()
    for (const schedule of due) {
      // Skip if already running or at max concurrency
      if (this.runningTeams.has(schedule.id)) continue
      if (this.runningTeams.size >= this.maxConcurrent) continue

      const template = this.agentStore.loadTeam(schedule.team)
      if (!template) {
        getLayout().log(theme.warning(`Schedule "${schedule.id}": team "${schedule.team}" not found, skipping.`))
        this.scheduleStore.markRun(schedule.id)
        continue
      }

      const workingDir = schedule.workingDir || template.workingDir || process.cwd()
      getLayout().log(theme.info(`[Scheduler] Running team "${schedule.team}" (${formatInterval(schedule.interval)} interval)`))
      this.scheduleStore.markRun(schedule.id)

      // Track in-flight and fire
      this.runningTeams.add(schedule.id)
      this.runTeamFn(template, workingDir).catch(err => {
        getLayout().log(theme.error(`[Scheduler] Team "${schedule.team}" failed: ${(err as Error).message}`))
      }).finally(() => {
        this.runningTeams.delete(schedule.id)
      })
    }
  }
}
