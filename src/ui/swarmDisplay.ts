import { theme } from './theme.js'

export interface AgentStatus {
  id: string
  name: string
  type: string
  status: 'running' | 'completed' | 'failed' | 'idle'
  toolCount: number
  tokenCount: number
  elapsed: number
}

const AGENT_COLORS = [theme.info, theme.success, theme.warning, theme.tool, theme.command]

export function renderSwarmStatus(agents: AgentStatus[]): string {
  if (agents.length === 0) return theme.dim('No active agents.')

  const lines: string[] = [theme.bold('Agent Swarm:'), '']

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    const color = AGENT_COLORS[i % AGENT_COLORS.length]
    const statusIcon = a.status === 'running' ? '▶'
      : a.status === 'completed' ? '✓'
      : a.status === 'failed' ? '✗' : '○'
    const statusColor = a.status === 'running' ? theme.info
      : a.status === 'completed' ? theme.success
      : a.status === 'failed' ? theme.error : theme.dim

    lines.push(`  ${statusColor(statusIcon)} ${color(a.name)} ${theme.dim(`(${a.type})`)}`)
    lines.push(`    ${theme.dim(`${a.toolCount} tools | ${a.tokenCount} tokens | ${a.elapsed}s`)}`)
  }

  return lines.join('\n')
}

export function renderAgentTree(agents: AgentStatus[]): string {
  if (agents.length === 0) return ''

  const lines: string[] = []
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    const isLast = i === agents.length - 1
    const prefix = isLast ? '└─' : '├─'
    const statusIcon = a.status === 'running' ? theme.info('●')
      : a.status === 'completed' ? theme.success('●')
      : theme.error('●')
    lines.push(`  ${prefix} ${statusIcon} ${a.name} ${theme.dim(`[${a.type}]`)}`)
  }

  return lines.join('\n')
}
