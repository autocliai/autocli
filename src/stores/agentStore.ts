import { getDb } from './db.js'
import path from 'path'
import { mkdirSync, existsSync, rmSync } from 'fs'

export interface AgentDefinition {
  name: string
  type: string
  model?: string
  provider?: string
  tools?: string[]
  instructions?: string
  soul?: string
  memory?: string
}

interface SaveAgentInput {
  name: string
  type: string
  model?: string
  provider?: string
  tools?: string[]
  instructions?: string
  soul?: string
}

export class AgentStore {
  private dir: string

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  async save(input: SaveAgentInput): Promise<void> {
    const db = getDb()
    const agentDir = path.join(this.dir, input.name)
    mkdirSync(agentDir, { recursive: true })

    const instrPath = path.join(agentDir, 'AGENT.md')
    if (input.instructions) await Bun.write(instrPath, input.instructions)
    if (input.soul) await Bun.write(path.join(agentDir, 'SOUL.md'), input.soul)
    if ((input as any).memory) await Bun.write(path.join(agentDir, 'MEMORY.md'), (input as any).memory)

    const soulPath = path.join(agentDir, 'SOUL.md')
    const memPath = path.join(agentDir, 'MEMORY.md')
    db.query(`INSERT OR REPLACE INTO agents (name, type, model, provider, tools, instructions_path, soul_path, memory_path, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      input.name, input.type, input.model || null, input.provider || null,
      input.tools ? JSON.stringify(input.tools) : null,
      existsSync(instrPath) ? instrPath : null,
      existsSync(soulPath) ? soulPath : null,
      existsSync(memPath) ? memPath : null,
    )
  }

  async load(name: string): Promise<AgentDefinition | null> {
    const db = getDb()
    const row = db.query('SELECT * FROM agents WHERE name = ?').get(name) as any
    if (!row) return null

    const agentDir = path.join(this.dir, name)
    let instructions: string | undefined, soul: string | undefined, memory: string | undefined

    const instrPath = path.join(agentDir, 'AGENT.md')
    const soulPath = path.join(agentDir, 'SOUL.md')
    const memPath = path.join(agentDir, 'MEMORY.md')

    if (existsSync(instrPath)) instructions = await Bun.file(instrPath).text()
    if (existsSync(soulPath)) soul = await Bun.file(soulPath).text()
    if (existsSync(memPath)) memory = await Bun.file(memPath).text()

    return {
      name: row.name, type: row.type, model: row.model || undefined,
      provider: row.provider || undefined,
      tools: row.tools ? (() => { try { return JSON.parse(row.tools) } catch { return undefined } })() : undefined,
      instructions, soul, memory,
    }
  }

  list(): { name: string; type: string }[] {
    return getDb().query('SELECT name, type FROM agents ORDER BY name').all() as any[]
  }

  async delete(name: string): Promise<void> {
    getDb().query('DELETE FROM agents WHERE name = ?').run(name)
    const agentDir = path.join(this.dir, name)
    if (existsSync(agentDir)) rmSync(agentDir, { recursive: true })
  }

  async appendMemory(name: string, content: string): Promise<void> {
    const memPath = path.join(this.dir, name, 'MEMORY.md')
    const date = new Date().toISOString().split('T')[0]
    const entry = `\n## ${date}\n${content}\n`
    const existing = existsSync(memPath) ? await Bun.file(memPath).text() : '# Agent Memory\n'
    await Bun.write(memPath, existing + entry)
  }

  async buildSystemPrompt(name: string): Promise<string> {
    const agent = await this.load(name)
    if (!agent) return ''
    const parts: string[] = []
    if (agent.instructions) parts.push(agent.instructions)
    if (agent.soul) parts.push(`\n## Personality\n${agent.soul}`)
    if (agent.memory) parts.push(`\n## Memory\n${agent.memory}`)
    return parts.join('\n')
  }
}
