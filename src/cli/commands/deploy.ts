import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { CommandDefinition } from './types.js'
import { AgentStore } from '../../stores/agentStore.js'
import { ScheduleStore, parseInterval, formatInterval } from '../../stores/scheduleStore.js'
import { parseBlueprint } from '../../services/teams/blueprintParser.js'
import { theme } from '../ui/theme.js'
import { platform } from '../../utils/platform.js'
import { join } from 'path'

export const deployCommand: CommandDefinition = {
  name: 'deploy',
  description: 'Deploy a team from a blueprint .md file (creates agents, team, and schedule)',
  aliases: ['blueprint'],

  async execute(args, ctx) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const filePath = parts[0]

    if (!filePath) {
      return {
        output: [
          theme.error('Usage: /deploy <blueprint.md>'),
          '',
          theme.dim('Blueprint format:'),
          theme.dim('  # Team: my-team'),
          theme.dim('  Goal: Review code for quality'),
          theme.dim('  Schedule: every 2h'),
          theme.dim('  '),
          theme.dim('  ## Agent: reviewer'),
          theme.dim('  Type: explore'),
          theme.dim('  Model: opus'),
          theme.dim('  Task: Review PRs for security issues'),
          theme.dim('  '),
          theme.dim('  ### AGENT.md'),
          theme.dim('  You are a security-focused reviewer...'),
          theme.dim('  '),
          theme.dim('  ---'),
        ].join('\n'),
      }
    }

    // Resolve path relative to working dir
    const absPath = resolve(ctx.workingDir, filePath)
    if (!existsSync(absPath)) {
      return { output: theme.error(`File not found: ${absPath}`) }
    }

    const content = readFileSync(absPath, 'utf-8')

    let blueprint
    try {
      blueprint = parseBlueprint(content)
    } catch (err) {
      return { output: theme.error(`Blueprint parse error: ${(err as Error).message}`) }
    }

    const agentsDir = join(platform.configDir, 'agents')
    const store = new AgentStore(agentsDir)
    const output: string[] = []

    // Create/update each agent
    for (const agent of blueprint.agents) {
      const { task: agentTask, ...agentDef } = agent
      await store.save(agentDef)
      // Persist agent task as memory so it's available at runtime
      if (agentTask) await store.appendMemory(agentDef.name, `## Default Task\n${agentTask}`)
      const files = [
        agentDef.instructions ? 'AGENT.md' : '',
        agentDef.soul ? 'SOUL.md' : '',
        agentDef.memory ? 'MEMORY.md' : '',
      ].filter(Boolean).join(', ')
      output.push(`  ${theme.success('✓')} Agent ${theme.info(agentDef.name)} ${theme.dim(`(${agentDef.type}${agentDef.model ? ', ' + agentDef.model : ''})`)}${files ? ' ' + theme.dim(`[${files}]`) : ''}`)
    }

    output.push(`  ${theme.success('✓')} Team ${theme.info(blueprint.teamName)} ${theme.dim(`(${blueprint.agents.length} agents)`)}`)

    // Create schedule if specified
    if (blueprint.schedule) {
      const intervalMs = parseInterval(blueprint.schedule)
      if (intervalMs > 0) {
        const scheduleStore = new ScheduleStore()
        // Remove existing schedule for this team if any
        for (const existing of scheduleStore.list()) {
          if (existing.teamName === blueprint.teamName) {
            scheduleStore.remove(existing.id)
          }
        }
        const sched = scheduleStore.add(blueprint.teamName, blueprint.schedule, blueprint.workingDir || ctx.workingDir)
        const nextRunStr = sched.nextRun ? new Date(sched.nextRun).toLocaleTimeString() : 'unknown'
        output.push(`  ${theme.success('✓')} Schedule: every ${blueprint.schedule} ${theme.dim(`(next: ${nextRunStr})`)}`)
      } else {
        output.push(`  ${theme.warning('⚠')} Invalid schedule interval: "${blueprint.schedule}"`)
      }
    }

    return {
      output: theme.bold(`Deployed "${blueprint.teamName}":\n`) + output.join('\n'),
    }
  },
}
