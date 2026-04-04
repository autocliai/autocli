import type { CommandDefinition } from './types.js'
import { ScheduleStore, parseInterval, formatInterval } from '../../stores/scheduleStore.js'
import { JobResultStore } from '../../stores/jobResultStore.js'
import { AgentStore } from '../../stores/agentStore.js'
import { theme } from '../ui/theme.js'
import { platform } from '../../utils/platform.js'
import { join } from 'path'

export const scheduleCommand: CommandDefinition = {
  name: 'schedule',
  description: 'Manage scheduled team runs',

  async execute(args, ctx) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const subcommand = parts[0] ?? 'list'
    const store = new ScheduleStore()

    switch (subcommand) {
      case 'list': {
        const schedules = store.list()
        if (schedules.length === 0) {
          return { output: theme.dim('No schedules configured. Use /schedule add <team> <interval> to create one.') }
        }
        const now = Date.now()
        const lines: string[] = [theme.bold('Scheduled team runs:'), '']
        for (const s of schedules) {
          const icon = s.enabled ? theme.success('●') : theme.dim('○')
          const interval = s.interval
          const lastRun = s.lastRun
            ? theme.dim(`last: ${new Date(s.lastRun).toLocaleString()}`)
            : theme.dim('never run')
          const nextRunMs = s.nextRun ? new Date(s.nextRun).getTime() - now : 0
          const nextRun = s.enabled
            ? nextRunMs > 0
              ? theme.info(`next: ${formatInterval(nextRunMs)}`)
              : theme.warning('next: overdue')
            : theme.dim('disabled')
          lines.push(`  ${icon} ${theme.bold(s.teamName)} ${theme.dim(`[${s.id}]`)} every ${interval}`)
          lines.push(`      ${lastRun}  ${nextRun}`)
        }
        return { output: lines.join('\n') }
      }

      case 'add': {
        const teamName = parts[1]
        const intervalStr = parts[2]
        if (!teamName) return { output: theme.error('Usage: /schedule add <team> <interval>') }
        if (!intervalStr) return { output: theme.error('Usage: /schedule add <team> <interval>') }

        const agentsDir = join(platform.configDir, 'agents')
        const agentStore = new AgentStore(agentsDir)
        const agents = agentStore.list()
        const teamExists = agents.some(a => a.name === teamName)
        const intervalMs = parseInterval(intervalStr)
        if (intervalMs <= 0) {
          return { output: theme.error(`Invalid interval: ${intervalStr}. Examples: 1h, 30m, 2h30m, 1d`) }
        }

        if (!teamExists) {
          // Warn but proceed — team may be defined elsewhere
          const sched = store.add(teamName, intervalStr, ctx.workingDir)
          return {
            output: theme.warning(`Warning: No agent named "${teamName}" found. Creating schedule anyway.\n`) +
              theme.success(`Schedule created: ${sched.id} — ${teamName} every ${intervalStr}`),
          }
        }

        const schedule = store.add(teamName, intervalStr, ctx.workingDir)
        return {
          output: theme.success(
            `Schedule created: ${schedule.id} — ${teamName} every ${intervalStr}`
          ),
        }
      }

      case 'remove': {
        const idStr = parts[1]
        if (!idStr) return { output: theme.error('Usage: /schedule remove <id>') }
        const id = parseInt(idStr, 10)
        if (isNaN(id)) return { output: theme.error(`Invalid schedule ID: ${idStr}`) }
        if (!store.get(id)) return { output: theme.error(`Schedule not found: ${idStr}`) }
        store.remove(id)
        return { output: theme.success(`Schedule removed: ${idStr}`) }
      }

      case 'enable': {
        const idStr = parts[1]
        if (!idStr) return { output: theme.error('Usage: /schedule enable <id>') }
        const id = parseInt(idStr, 10)
        if (isNaN(id)) return { output: theme.error(`Invalid schedule ID: ${idStr}`) }
        if (!store.get(id)) return { output: theme.error(`Schedule not found: ${idStr}`) }
        store.enable(id)
        return { output: theme.success(`Schedule enabled: ${idStr}`) }
      }

      case 'disable': {
        const idStr = parts[1]
        if (!idStr) return { output: theme.error('Usage: /schedule disable <id>') }
        const id = parseInt(idStr, 10)
        if (isNaN(id)) return { output: theme.error(`Invalid schedule ID: ${idStr}`) }
        if (!store.get(id)) return { output: theme.error(`Schedule not found: ${idStr}`) }
        store.disable(id)
        return { output: theme.success(`Schedule disabled: ${idStr}`) }
      }

      case 'run': {
        const teamName = parts[1]
        if (!teamName) return { output: theme.error('Usage: /schedule run <team>') }
        return { type: 'run_team', team: teamName, workingDir: ctx.workingDir }
      }

      case 'results': {
        const jobStore = new JobResultStore()
        const filterStr = parts[1] // optional: numeric id or --schedule <id>
        const isScheduleFilter = filterStr === '--schedule' || filterStr === '-s'
        if (isScheduleFilter) {
          // Filter by schedule ID: /schedule results --schedule <id>
          const schedIdStr = parts[2]
          if (!schedIdStr) return { output: theme.error('Usage: /schedule results --schedule <schedule-id>') }
          const schedId = parseInt(schedIdStr, 10)
          if (isNaN(schedId)) return { output: theme.error(`Invalid schedule ID: ${schedIdStr}`) }
          const results = jobStore.getBySchedule(schedId)
          if (results.length === 0) return { output: theme.dim(`No job results found for schedule ${schedId}.`) }
          const lines: string[] = [theme.bold(`Job Results for schedule ${schedId}:`), '']
          for (const r of results) {
            const icon = r.status === 'success' ? theme.success('✓') : r.status === 'partial' ? theme.warning('◐') : theme.error('✗')
            const time = new Date(r.startedAt).toLocaleString()
            lines.push(`  ${icon} ${theme.bold(String(r.id))} ${r.status} ${theme.dim(time)}`)
          }
          return { output: lines.join('\n') }
        }
        if (filterStr) {
          const filterId = parseInt(filterStr, 10)
          if (isNaN(filterId)) return { output: theme.error(`Invalid job ID: ${filterStr}`) }
          const job = jobStore.get(filterId)
          if (!job) return { output: theme.error(`Job not found: ${filterId}`) }
          return { output: formatJobDetail(job) }
        }
        const results = jobStore.list()
        if (results.length === 0) {
          return { output: theme.dim('No job results found.') }
        }
        const lines: string[] = [theme.bold('Job Results:'), '']
        for (const r of results) {
          const icon = r.status === 'success' ? theme.success('✓')
            : r.status === 'partial' ? theme.warning('◐')
            : theme.error('✗')
          const startedMs = new Date(r.startedAt).getTime()
          const finishedMs = r.finishedAt ? new Date(r.finishedAt).getTime() : Date.now()
          const duration = formatInterval(finishedMs - startedMs)
          const time = new Date(r.startedAt).toLocaleString()
          lines.push(`  ${icon} ${theme.bold(String(r.id))} ${theme.dim(`[${r.teamName}]`)} ${r.status} ${theme.dim(`(${duration})`)}`)
          lines.push(`      ${theme.dim(time)} — ${r.agents.length} agent(s)`)
        }
        lines.push('')
        lines.push(theme.dim('View details: /schedule results <job-id>'))
        return { output: lines.join('\n') }
      }

      default:
        return {
          output: theme.error(
            `Unknown subcommand: ${subcommand}. Available: list, add, remove, enable, disable, run, results`
          ),
        }
    }
  },
}

function formatJobDetail(job: import('../../stores/jobResultStore.js').JobResult): string {
  const lines: string[] = []
  const statusIcon = job.status === 'success' ? theme.success('✓')
    : job.status === 'partial' ? theme.warning('◐')
    : theme.error('✗')
  const startedMs = new Date(job.startedAt).getTime()
  const finishedMs = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now()
  const duration = formatInterval(finishedMs - startedMs)

  lines.push(theme.bold(`Job: ${job.id}`))
  lines.push(`  Team:     ${job.teamName}`)
  lines.push(`  Status:   ${statusIcon} ${job.status}`)
  lines.push(`  Started:  ${new Date(job.startedAt).toLocaleString()}`)
  lines.push(`  Duration: ${duration}`)
  if (job.scheduleId) lines.push(`  Schedule: ${job.scheduleId}`)
  lines.push('')
  lines.push(theme.bold('  Agent Results:'))

  for (const a of job.agents) {
    const icon = a.status === 'success' ? theme.success('✓') : theme.error('✗')
    lines.push(`    ${icon} ${theme.bold(a.name)}`)
    if (a.error) {
      lines.push(`      ${theme.error('Error: ' + a.error)}`)
    }
    if (a.result) {
      // Show first 500 chars of result
      const preview = a.result.length > 500 ? a.result.slice(0, 500) + '...' : a.result
      for (const line of preview.split('\n')) {
        lines.push(`      ${theme.dim(line)}`)
      }
    }
  }

  return lines.join('\n')
}
