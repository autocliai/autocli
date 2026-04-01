import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { platform } from '../utils/platform.js'
import type { AgentDefinition, TeamTemplate } from './types.js'

export class AgentStore {
  private agentsDir: string
  private teamsDir: string

  constructor() {
    this.agentsDir = join(platform.configDir, 'agents')
    this.teamsDir = join(platform.configDir, 'teams')
    mkdirSync(this.agentsDir, { recursive: true })
    mkdirSync(this.teamsDir, { recursive: true })
  }

  // --- Agent CRUD ---

  saveAgent(agent: AgentDefinition): void {
    const dir = join(this.agentsDir, agent.name)
    mkdirSync(dir, { recursive: true })

    const json: Omit<AgentDefinition, 'agentMd' | 'soulMd' | 'memoryMd'> = {
      name: agent.name,
      description: agent.description,
      agentType: agent.agentType,
      ...(agent.model !== undefined && { model: agent.model }),
      ...(agent.provider !== undefined && { provider: agent.provider }),
      ...(agent.tools !== undefined && { tools: agent.tools }),
    }
    writeFileSync(join(dir, 'agent.json'), JSON.stringify(json, null, 2))

    if (agent.agentMd !== undefined) {
      writeFileSync(join(dir, 'AGENT.md'), agent.agentMd)
    }
    if (agent.soulMd !== undefined) {
      writeFileSync(join(dir, 'SOUL.md'), agent.soulMd)
    }
    if (agent.memoryMd !== undefined) {
      writeFileSync(join(dir, 'MEMORY.md'), agent.memoryMd)
    }
  }

  loadAgent(name: string): AgentDefinition {
    const dir = join(this.agentsDir, name)
    const jsonPath = join(dir, 'agent.json')
    if (!existsSync(jsonPath)) {
      throw new Error(`Agent not found: ${name}`)
    }

    let agent: AgentDefinition
    try {
      agent = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    } catch {
      throw new Error(`Agent "${name}" has a corrupted config file`)
    }

    const agentMdPath = join(dir, 'AGENT.md')
    if (existsSync(agentMdPath)) {
      agent.agentMd = readFileSync(agentMdPath, 'utf-8')
    }

    const soulMdPath = join(dir, 'SOUL.md')
    if (existsSync(soulMdPath)) {
      agent.soulMd = readFileSync(soulMdPath, 'utf-8')
    }

    const memoryMdPath = join(dir, 'MEMORY.md')
    if (existsSync(memoryMdPath)) {
      agent.memoryMd = readFileSync(memoryMdPath, 'utf-8')
    }

    return agent
  }

  listAgents(): string[] {
    if (!existsSync(this.agentsDir)) return []
    return readdirSync(this.agentsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(join(this.agentsDir, entry.name, 'agent.json')))
      .map(entry => entry.name)
  }

  deleteAgent(name: string): void {
    const dir = join(this.agentsDir, name)
    rmSync(dir, { recursive: true, force: true })
  }

  // --- System Prompt Builder ---

  buildSystemPrompt(agent: AgentDefinition, basePrompt?: string): string {
    const sections: string[] = []

    if (basePrompt) {
      sections.push(basePrompt)
    }

    if (agent.agentMd) {
      sections.push(`## Agent Instructions\n\n${agent.agentMd}`)
    }

    if (agent.soulMd) {
      sections.push(`## Soul\n\n${agent.soulMd}`)
    }

    if (agent.memoryMd) {
      sections.push(`## Memory\n\n${agent.memoryMd}`)
    }

    return sections.join('\n\n---\n\n')
  }

  // --- Memory Append ---

  appendMemory(name: string, entry: string): void {
    const dir = join(this.agentsDir, name)
    mkdirSync(dir, { recursive: true })
    const memoryPath = join(dir, 'MEMORY.md')
    const date = new Date().toISOString().split('T')[0]
    const dated = `[${date}] ${entry}`
    if (existsSync(memoryPath)) {
      const existing = readFileSync(memoryPath, 'utf-8')
      writeFileSync(memoryPath, `${existing}\n${dated}`)
    } else {
      writeFileSync(memoryPath, dated)
    }
  }

  // --- Team Template CRUD ---

  saveTeam(template: TeamTemplate): void {
    const path = join(this.teamsDir, `${template.name}.json`)
    writeFileSync(path, JSON.stringify(template, null, 2))
  }

  loadTeam(name: string): TeamTemplate {
    const path = join(this.teamsDir, `${name}.json`)
    if (!existsSync(path)) {
      throw new Error(`Team not found: ${name}`)
    }
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      throw new Error(`Team "${name}" has a corrupted config file`)
    }
  }

  listTeams(): string[] {
    if (!existsSync(this.teamsDir)) return []
    return readdirSync(this.teamsDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => entry.name.slice(0, -'.json'.length))
  }

  deleteTeam(name: string): void {
    const path = join(this.teamsDir, `${name}.json`)
    rmSync(path, { force: true })
  }
}
