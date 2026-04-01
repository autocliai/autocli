export interface AgentDefinition {
  name: string
  description: string
  agentType: string        // maps to AGENT_TYPES (general-purpose, explore, plan, worker)
  model?: string           // model override (opus, sonnet, haiku)
  provider?: 'anthropic' | 'openai' | 'claude-local'
  tools?: string[]         // override allowed tools (null = use agentType defaults)
  // Loaded at runtime from markdown files:
  agentMd?: string         // content of AGENT.md
  soulMd?: string          // content of SOUL.md
  memoryMd?: string        // content of MEMORY.md
}

export interface TeamTemplate {
  name: string
  goal: string
  agents: Array<{
    agentName: string      // references ~/.autocli/agents/<name>
    task: string           // task description for this agent in the team
  }>
  workingDir?: string      // default working directory
}
