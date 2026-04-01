import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { CommandDefinition, CommandResult } from './types.js'
import { AgentStore } from '../agents/agentStore.js'
import { ScheduleStore, parseInterval, formatInterval } from '../scheduler/scheduleStore.js'
import { parseBlueprint, blueprintToTeamTemplate } from '../agents/blueprintParser.js'
import { theme } from '../ui/theme.js'

export const deployCommand: CommandDefinition = {
  name: 'deploy',
  description: 'Deploy a team from a blueprint .md file (creates agents, team, and schedule)',
  aliases: ['blueprint'],

  async run(args, ctx): Promise<CommandResult> {
    const filePath = args[0]

    if (!filePath) {
      return {
        type: 'output',
        text: [
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
      return { type: 'output', text: theme.error(`File not found: ${absPath}`) }
    }

    const content = readFileSync(absPath, 'utf-8')

    let blueprint
    try {
      blueprint = parseBlueprint(content)
    } catch (err) {
      return { type: 'output', text: theme.error(`Blueprint parse error: ${(err as Error).message}`) }
    }

    const store = new AgentStore()
    const output: string[] = []

    // Create/update each agent
    for (const agent of blueprint.agents) {
      const { task, ...agentDef } = agent
      store.saveAgent(agentDef)
      const files = [
        agentDef.agentMd ? 'AGENT.md' : '',
        agentDef.soulMd ? 'SOUL.md' : '',
        agentDef.memoryMd ? 'MEMORY.md' : '',
      ].filter(Boolean).join(', ')
      output.push(`  ${theme.success('✓')} Agent ${theme.info(agentDef.name)} ${theme.dim(`(${agentDef.agentType}${agentDef.model ? ', ' + agentDef.model : ''})`)}${files ? ' ' + theme.dim(`[${files}]`) : ''}`)
    }

    // Create team template
    const template = blueprintToTeamTemplate(blueprint)
    store.saveTeam(template)
    output.push(`  ${theme.success('✓')} Team ${theme.info(blueprint.teamName)} ${theme.dim(`(${blueprint.agents.length} agents)`)}`)

    // Create schedule if specified
    if (blueprint.schedule) {
      const intervalMs = parseInterval(blueprint.schedule)
      if (intervalMs) {
        const scheduleStore = new ScheduleStore()
        // Remove existing schedule for this team if any
        for (const existing of scheduleStore.list()) {
          if (existing.team === blueprint.teamName) {
            scheduleStore.remove(existing.id)
          }
        }
        const sched = scheduleStore.add(blueprint.teamName, intervalMs, blueprint.workingDir || ctx.workingDir)
        output.push(`  ${theme.success('✓')} Schedule: every ${formatInterval(intervalMs)} ${theme.dim(`(next: ${new Date(sched.nextRun).toLocaleTimeString()})`)}`)
      } else {
        output.push(`  ${theme.warning('⚠')} Invalid schedule interval: "${blueprint.schedule}"`)
      }
    }

    return {
      type: 'output',
      text: theme.bold(`Deployed "${blueprint.teamName}":\n`) + output.join('\n'),
    }
  },
}
