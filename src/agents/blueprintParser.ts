import type { AgentDefinition, TeamTemplate } from './types.js'

/**
 * Parse a team blueprint markdown file into agents, team template, and schedule config.
 *
 * Format:
 * ```markdown
 * # Team: <name>
 *
 * Goal: <goal description>
 * Schedule: every <interval>        (optional)
 * WorkingDir: /path/to/dir          (optional)
 *
 * ## Agent: <agent-name>
 * Type: <agent-type>                (optional, default: general-purpose)
 * Model: <model>                    (optional)
 * Provider: <provider>              (optional)
 * Task: <task description>          (optional, defaults to agent description)
 *
 * ### AGENT.md
 * <content>
 *
 * ### SOUL.md
 * <content>
 *
 * ### MEMORY.md
 * <content>
 *
 * ---
 *
 * ## Agent: <another-agent>
 * ...
 * ```
 */

export interface BlueprintResult {
  teamName: string
  goal: string
  schedule?: string        // e.g. "2h", "30m"
  workingDir?: string
  agents: Array<AgentDefinition & { task?: string }>
}

export function parseBlueprint(content: string): BlueprintResult {
  const lines = content.split('\n')

  // Parse team header
  const teamLine = lines.find(l => /^#\s+Team:\s*/i.test(l))
  if (!teamLine) throw new Error('Blueprint must start with "# Team: <name>"')
  const teamName = teamLine.replace(/^#\s+Team:\s*/i, '').trim()
  if (!teamName) throw new Error('Team name cannot be empty')

  // Parse team-level metadata
  let goal = ''
  let schedule: string | undefined
  let workingDir: string | undefined

  for (const line of lines) {
    const goalMatch = line.match(/^Goal:\s*(.+)/i)
    if (goalMatch) { goal = goalMatch[1].trim(); continue }

    const scheduleMatch = line.match(/^Schedule:\s*(?:every\s+)?(.+)/i)
    if (scheduleMatch) { schedule = scheduleMatch[1].trim(); continue }

    const wdMatch = line.match(/^WorkingDir:\s*(.+)/i)
    if (wdMatch) { workingDir = wdMatch[1].trim(); continue }
  }

  if (!goal) throw new Error('Blueprint must include "Goal: <description>"')

  // Split into agent sections by "## Agent:" headers
  const agentSections: string[] = []
  let currentSection = ''
  let inAgentSection = false

  for (const line of lines) {
    if (/^##\s+Agent:\s*/i.test(line)) {
      if (inAgentSection && currentSection) {
        agentSections.push(currentSection)
      }
      currentSection = line + '\n'
      inAgentSection = true
    } else if (inAgentSection) {
      // A horizontal rule (---) separates agents
      if (/^---\s*$/.test(line)) {
        agentSections.push(currentSection)
        currentSection = ''
        inAgentSection = false
      } else {
        currentSection += line + '\n'
      }
    }
  }
  if (inAgentSection && currentSection) {
    agentSections.push(currentSection)
  }

  if (agentSections.length === 0) {
    throw new Error('Blueprint must include at least one "## Agent: <name>" section')
  }

  // Parse each agent section
  const agents: Array<AgentDefinition & { task?: string }> = []

  for (const section of agentSections) {
    const agent = parseAgentSection(section)
    agents.push(agent)
  }

  return { teamName, goal, schedule, workingDir, agents }
}

function parseAgentSection(section: string): AgentDefinition & { task?: string } {
  const lines = section.split('\n')

  // Agent name from header
  const headerLine = lines.find(l => /^##\s+Agent:\s*/i.test(l))
  if (!headerLine) throw new Error('Agent section missing "## Agent: <name>" header')
  const name = headerLine.replace(/^##\s+Agent:\s*/i, '').trim()
  if (!name) throw new Error('Agent name cannot be empty')

  // Parse metadata fields
  let agentType = 'general-purpose'
  let model: string | undefined
  let provider: AgentDefinition['provider']
  let task: string | undefined
  let description = ''

  for (const line of lines) {
    const typeMatch = line.match(/^Type:\s*(.+)/i)
    if (typeMatch) { agentType = typeMatch[1].trim(); continue }

    const modelMatch = line.match(/^Model:\s*(.+)/i)
    if (modelMatch) { model = modelMatch[1].trim(); continue }

    const providerMatch = line.match(/^Provider:\s*(.+)/i)
    if (providerMatch) { provider = providerMatch[1].trim() as AgentDefinition['provider']; continue }

    const taskMatch = line.match(/^Task:\s*(.+)/i)
    if (taskMatch) { task = taskMatch[1].trim(); continue }

    const descMatch = line.match(/^Description:\s*(.+)/i)
    if (descMatch) { description = descMatch[1].trim(); continue }
  }

  // Extract ### AGENT.md, ### SOUL.md, ### MEMORY.md content
  const agentMd = extractSubsection(section, 'AGENT.md')
  const soulMd = extractSubsection(section, 'SOUL.md')
  const memoryMd = extractSubsection(section, 'MEMORY.md')

  return {
    name,
    description: description || `${name} agent`,
    agentType,
    model,
    provider,
    task,
    agentMd,
    soulMd,
    memoryMd,
  }
}

function extractSubsection(section: string, heading: string): string | undefined {
  const lines = section.split('\n')
  const headerPattern = new RegExp(`^###\\s+${heading.replace('.', '\\.')}\\s*$`, 'i')

  let capturing = false
  const captured: string[] = []

  for (const line of lines) {
    if (headerPattern.test(line)) {
      capturing = true
      continue
    }
    if (capturing) {
      // Stop at next ### heading, ## heading, or ---
      if (/^###?\s+/.test(line) || /^---\s*$/.test(line)) {
        break
      }
      captured.push(line)
    }
  }

  if (captured.length === 0) return undefined

  // Trim leading/trailing blank lines
  const content = captured.join('\n').trim()
  return content || undefined
}

/** Convert a parsed blueprint into a TeamTemplate */
export function blueprintToTeamTemplate(bp: BlueprintResult): TeamTemplate {
  return {
    name: bp.teamName,
    goal: bp.goal,
    workingDir: bp.workingDir,
    agents: bp.agents.map(a => ({
      agentName: a.name,
      task: a.task || a.description || `${a.name} agent task`,
    })),
  }
}
