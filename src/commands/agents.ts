import type { CommandDefinition } from './types.js'
import { AgentStore } from '../agents/agentStore.js'
import { theme } from '../ui/theme.js'
import { existsSync } from 'fs'
import { join } from 'path'
import { platform } from '../utils/platform.js'

export const agentsCommand: CommandDefinition = {
  name: 'agents',
  description: 'Manage persistent agent definitions',

  async run(args, _context): Promise<string> {
    const store = new AgentStore()
    const sub = args[0] ?? 'list'
    const name = args[1]

    switch (sub) {
      case 'list': {
        const agents = store.listAgents()
        if (agents.length === 0) {
          return [
            theme.bold('Agents:'),
            '',
            theme.dim('No agents defined. Use /agents create <name> to create one.'),
          ].join('\n')
        }

        const agentsDir = join(platform.configDir, 'agents')
        const lines: string[] = [theme.bold('Agents:'), '']
        for (const agentName of agents) {
          try {
            const agent = store.loadAgent(agentName)
            const dir = join(agentsDir, agentName)
            const hasAgent = existsSync(join(dir, 'AGENT.md'))
            const hasSoul = existsSync(join(dir, 'SOUL.md'))
            const hasMemory = existsSync(join(dir, 'MEMORY.md'))
            const files = [
              hasAgent ? 'AGENT.md' : null,
              hasSoul ? 'SOUL.md' : null,
              hasMemory ? 'MEMORY.md' : null,
            ].filter(Boolean)
            const filesStr = files.length > 0 ? theme.dim(` [${files.join(', ')}]`) : ''
            lines.push(
              `  ${theme.bold(agentName)} ${theme.info(`(${agent.agentType})`)}${filesStr}`,
            )
            if (agent.description) {
              lines.push(`    ${theme.dim(agent.description)}`)
            }
          } catch {
            lines.push(`  ${theme.warning(agentName)} ${theme.dim('(error loading)')}`)
          }
        }
        lines.push('')
        lines.push(theme.dim('Use /agents show <name> for details.'))
        return lines.join('\n')
      }

      case 'show': {
        if (!name) return theme.error('Usage: /agents show <name>')
        let agent
        try {
          agent = store.loadAgent(name)
        } catch (e: unknown) {
          return theme.error((e as Error).message)
        }

        const lines: string[] = [
          theme.bold(`Agent: ${agent.name}`),
          '',
          `  ${theme.key('Type:')}     ${agent.agentType}`,
          `  ${theme.key('Description:')} ${agent.description || theme.dim('(none)')}`,
        ]
        if (agent.model) lines.push(`  ${theme.key('Model:')}    ${agent.model}`)
        if (agent.provider) lines.push(`  ${theme.key('Provider:')} ${agent.provider}`)
        if (agent.tools && agent.tools.length > 0) {
          lines.push(`  ${theme.key('Tools:')}    ${agent.tools.join(', ')}`)
        }

        if (agent.agentMd) {
          lines.push('', theme.bold('AGENT.md:'), theme.dim('─'.repeat(40)), agent.agentMd.trim())
        }
        if (agent.soulMd) {
          lines.push('', theme.bold('SOUL.md:'), theme.dim('─'.repeat(40)), agent.soulMd.trim())
        }
        if (agent.memoryMd) {
          lines.push('', theme.bold('MEMORY.md:'), theme.dim('─'.repeat(40)), agent.memoryMd.trim())
        }

        return lines.join('\n')
      }

      case 'create': {
        if (!name) return theme.error('Usage: /agents create <name>')

        // Check if agent already exists
        const existing = store.listAgents()
        if (existing.includes(name)) {
          return theme.error(`Agent already exists: ${name}`)
        }

        store.saveAgent({
          name,
          description: `${name} agent`,
          agentType: 'general-purpose',
        })

        const agentsDir = join(platform.configDir, 'agents')
        const agentDir = join(agentsDir, name)

        return [
          theme.success(`Agent created: ${name}`),
          '',
          `  ${theme.key('Directory:')} ${agentDir}`,
          '',
          theme.bold('Next steps — edit these files to customize the agent:'),
          '',
          `  ${theme.info('AGENT.md')}   ${theme.dim('— task instructions and capabilities')}`,
          `  ${theme.info('SOUL.md')}    ${theme.dim('— personality and communication style')}`,
          `  ${theme.info('MEMORY.md')} ${theme.dim('— persistent memory and context')}`,
          '',
          theme.dim(`Files live in: ${agentDir}`),
        ].join('\n')
      }

      case 'delete': {
        if (!name) return theme.error('Usage: /agents delete <name>')

        const existing = store.listAgents()
        if (!existing.includes(name)) {
          return theme.error(`Agent not found: ${name}`)
        }

        store.deleteAgent(name)
        return theme.success(`Agent deleted: ${name}`)
      }

      default:
        return [
          theme.error(`Unknown subcommand: ${sub}`),
          '',
          theme.bold('Usage:'),
          '  /agents              List all agents',
          '  /agents list         List all agents',
          '  /agents show <name>  Show agent details',
          '  /agents create <name> Create a new agent',
          '  /agents delete <name> Delete an agent',
        ].join('\n')
    }
  },
}
