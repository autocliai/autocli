import type { CommandDefinition } from './types.js'
import { AgentStore } from '../../stores/agentStore.js'
import { theme } from '../ui/theme.js'
import { platform } from '../../utils/platform.js'
import { join } from 'path'

export const agentsCommand: CommandDefinition = {
  name: 'agents',
  description: 'Manage persistent agent definitions',

  async execute(args, _context) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const agentsDir = join(platform.configDir, 'agents')
    const store = new AgentStore(agentsDir)
    const sub = parts[0] ?? 'list'
    const name = parts[1]

    switch (sub) {
      case 'list': {
        const agents = store.list()
        if (agents.length === 0) {
          return {
            output: [
              theme.bold('Agents:'),
              '',
              theme.dim('No agents defined. Use /agents create <name> to create one.'),
            ].join('\n'),
          }
        }

        const lines: string[] = [theme.bold('Agents:'), '']
        for (const { name: agentName, type } of agents) {
          lines.push(`  ${theme.bold(agentName)} ${theme.info(`(${type})`)}`)
        }
        lines.push('')
        lines.push(theme.dim('Use /agents show <name> for details.'))
        return { output: lines.join('\n') }
      }

      case 'show': {
        if (!name) return { output: theme.error('Usage: /agents show <name>') }
        const agent = await store.load(name)
        if (!agent) {
          return { output: theme.error(`Agent not found: ${name}`) }
        }

        const lines: string[] = [
          theme.bold(`Agent: ${agent.name}`),
          '',
          `  ${theme.key('Type:')}     ${agent.type}`,
        ]
        if (agent.model) lines.push(`  ${theme.key('Model:')}    ${agent.model}`)
        if (agent.provider) lines.push(`  ${theme.key('Provider:')} ${agent.provider}`)
        if (agent.tools && agent.tools.length > 0) {
          lines.push(`  ${theme.key('Tools:')}    ${agent.tools.join(', ')}`)
        }

        if (agent.instructions) {
          lines.push('', theme.bold('AGENT.md:'), theme.dim('─'.repeat(40)), agent.instructions.trim())
        }
        if (agent.soul) {
          lines.push('', theme.bold('SOUL.md:'), theme.dim('─'.repeat(40)), agent.soul.trim())
        }
        if (agent.memory) {
          lines.push('', theme.bold('MEMORY.md:'), theme.dim('─'.repeat(40)), agent.memory.trim())
        }

        return { output: lines.join('\n') }
      }

      case 'create': {
        if (!name) return { output: theme.error('Usage: /agents create <name>') }

        // Check if agent already exists
        const existing = store.list()
        if (existing.some(a => a.name === name)) {
          return { output: theme.error(`Agent already exists: ${name}`) }
        }

        await store.save({
          name,
          type: 'general-purpose',
          instructions: `# ${name} Agent\n\nYou are a general-purpose agent named ${name}.`,
        })

        const agentDir = join(agentsDir, name)

        return {
          output: [
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
          ].join('\n'),
        }
      }

      case 'delete': {
        if (!name) return { output: theme.error('Usage: /agents delete <name>') }

        const existing = store.list()
        if (!existing.some(a => a.name === name)) {
          return { output: theme.error(`Agent not found: ${name}`) }
        }

        await store.delete(name)
        return { output: theme.success(`Agent deleted: ${name}`) }
      }

      default:
        return {
          output: [
            theme.error(`Unknown subcommand: ${sub}`),
            '',
            theme.bold('Usage:'),
            '  /agents              List all agents',
            '  /agents list         List all agents',
            '  /agents show <name>  Show agent details',
            '  /agents create <name> Create a new agent',
            '  /agents delete <name> Delete an agent',
          ].join('\n'),
        }
    }
  },
}
