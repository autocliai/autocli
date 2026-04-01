# Persistent Agents + Team Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent agent definitions with per-agent instruction files (AGENT.md, SOUL.md, MEMORY.md) and a hybrid scheduler that runs teams on intervals — as a REPL background thread, standalone daemon, or external cron target.

**Architecture:** Agent definitions stored as directories under `~/.autocli/agents/<name>/` with instruction files loaded into system prompts. Team templates stored as JSON in `~/.autocli/teams/`. Schedules stored in `~/.autocli/schedules.json`. Scheduler is a timer loop that checks due schedules and dispatches teams via the existing `QueryEngine` + `TeamManager`.

**Tech Stack:** TypeScript, Bun runtime, filesystem persistence (JSON + Markdown), existing QueryEngine/TeamManager

---

## File Structure

```
src/
  agents/
    agentStore.ts        — CRUD for agent definitions on disk, load instruction files
    types.ts             — AgentDefinition interface
  scheduler/
    scheduleStore.ts     — CRUD for schedules on disk
    scheduler.ts         — Timer loop that checks & dispatches due schedules
    types.ts             — Schedule interface
  commands/
    agents.ts            — /agents command (list, create, show, delete)
    schedule.ts          — /schedule command (add, list, remove, run)

Disk layout:
  ~/.autocli/
    agents/
      code-reviewer/
        agent.json       — { name, description, agentType, model, tools, provider }
        AGENT.md         — Role, goals, constraints
        SOUL.md          — Personality, decision style
        MEMORY.md        — Accumulated learnings (grows over time)
      deploy-checker/
        agent.json
        AGENT.md
    teams/
      code-review.json   — { name, goal, agents: ["code-reviewer", ...], workingDir }
    schedules.json       — [{ id, team, interval, lastRun, enabled, workingDir }]
```

---

### Task 1: Agent Definition Types

**Files:**
- Create: `src/agents/types.ts`

- [ ] **Step 1: Create the type file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/types.ts
git commit -m "feat: add AgentDefinition and TeamTemplate types"
```

---

### Task 2: Agent Store — CRUD + Instruction File Loading

**Files:**
- Create: `src/agents/agentStore.ts`

- [ ] **Step 1: Implement AgentStore**

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { platform } from '../utils/platform.js'
import type { AgentDefinition, TeamTemplate } from './types.js'

const AGENTS_DIR = join(platform.configDir, 'agents')
const TEAMS_DIR = join(platform.configDir, 'teams')

export class AgentStore {
  constructor() {
    mkdirSync(AGENTS_DIR, { recursive: true })
    mkdirSync(TEAMS_DIR, { recursive: true })
  }

  // ── Agent CRUD ──

  saveAgent(agent: AgentDefinition): void {
    const dir = join(AGENTS_DIR, agent.name)
    mkdirSync(dir, { recursive: true })
    const { agentMd, soulMd, memoryMd, ...meta } = agent
    writeFileSync(join(dir, 'agent.json'), JSON.stringify(meta, null, 2))
    if (agentMd !== undefined) writeFileSync(join(dir, 'AGENT.md'), agentMd)
    if (soulMd !== undefined) writeFileSync(join(dir, 'SOUL.md'), soulMd)
    if (memoryMd !== undefined) writeFileSync(join(dir, 'MEMORY.md'), memoryMd)
  }

  loadAgent(name: string): AgentDefinition | null {
    const dir = join(AGENTS_DIR, name)
    const metaPath = join(dir, 'agent.json')
    if (!existsSync(metaPath)) return null
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as AgentDefinition
    meta.agentMd = this.readOptional(join(dir, 'AGENT.md'))
    meta.soulMd = this.readOptional(join(dir, 'SOUL.md'))
    meta.memoryMd = this.readOptional(join(dir, 'MEMORY.md'))
    return meta
  }

  listAgents(): string[] {
    if (!existsSync(AGENTS_DIR)) return []
    return readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && existsSync(join(AGENTS_DIR, d.name, 'agent.json')))
      .map(d => d.name)
  }

  deleteAgent(name: string): boolean {
    const dir = join(AGENTS_DIR, name)
    if (!existsSync(dir)) return false
    rmSync(dir, { recursive: true })
    return true
  }

  /** Build full system prompt for an agent by combining its type prompt + instruction files */
  buildSystemPrompt(agent: AgentDefinition, basePrompt?: string): string {
    const parts: string[] = []
    if (basePrompt) parts.push(basePrompt)
    if (agent.agentMd) parts.push(`# Agent Instructions\n\n${agent.agentMd}`)
    if (agent.soulMd) parts.push(`# Agent Identity\n\n${agent.soulMd}`)
    if (agent.memoryMd) parts.push(`# Agent Memory\n\n${agent.memoryMd}`)
    return parts.filter(Boolean).join('\n\n---\n\n')
  }

  /** Append to an agent's MEMORY.md */
  appendMemory(name: string, entry: string): void {
    const dir = join(AGENTS_DIR, name)
    if (!existsSync(dir)) return
    const memPath = join(dir, 'MEMORY.md')
    const existing = this.readOptional(memPath) || '# Agent Memory\n'
    const timestamp = new Date().toISOString().split('T')[0]
    writeFileSync(memPath, `${existing}\n\n## ${timestamp}\n\n${entry}`)
  }

  // ── Team Template CRUD ──

  saveTeam(template: TeamTemplate): void {
    writeFileSync(join(TEAMS_DIR, `${template.name}.json`), JSON.stringify(template, null, 2))
  }

  loadTeam(name: string): TeamTemplate | null {
    const path = join(TEAMS_DIR, `${name}.json`)
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8'))
  }

  listTeams(): string[] {
    if (!existsSync(TEAMS_DIR)) return []
    return readdirSync(TEAMS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  }

  deleteTeam(name: string): boolean {
    const path = join(TEAMS_DIR, `${name}.json`)
    if (!existsSync(path)) return false
    rmSync(path)
    return true
  }

  private readOptional(path: string): string | undefined {
    if (!existsSync(path)) return undefined
    return readFileSync(path, 'utf-8')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/agentStore.ts
git commit -m "feat: add AgentStore for persistent agent definitions with instruction files"
```

---

### Task 3: Schedule Types + Store

**Files:**
- Create: `src/scheduler/types.ts`
- Create: `src/scheduler/scheduleStore.ts`

- [ ] **Step 1: Create schedule types**

```typescript
export interface Schedule {
  id: string
  team: string             // team template name
  interval: number         // milliseconds
  lastRun: number | null   // epoch ms
  nextRun: number          // epoch ms
  enabled: boolean
  workingDir?: string      // override team's default
}
```

- [ ] **Step 2: Create ScheduleStore**

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { platform } from '../utils/platform.js'
import type { Schedule } from './types.js'

const SCHEDULES_PATH = join(platform.configDir, 'schedules.json')

export class ScheduleStore {
  private schedules: Schedule[] = []

  constructor() {
    mkdirSync(platform.configDir, { recursive: true })
    this.load()
  }

  private load(): void {
    if (!existsSync(SCHEDULES_PATH)) { this.schedules = []; return }
    this.schedules = JSON.parse(readFileSync(SCHEDULES_PATH, 'utf-8'))
  }

  private save(): void {
    writeFileSync(SCHEDULES_PATH, JSON.stringify(this.schedules, null, 2))
  }

  add(team: string, intervalMs: number, workingDir?: string): Schedule {
    const now = Date.now()
    const schedule: Schedule = {
      id: `sched-${now}`,
      team,
      interval: intervalMs,
      lastRun: null,
      nextRun: now + intervalMs,
      enabled: true,
      workingDir,
    }
    this.schedules.push(schedule)
    this.save()
    return schedule
  }

  remove(id: string): boolean {
    const before = this.schedules.length
    this.schedules = this.schedules.filter(s => s.id !== id)
    if (this.schedules.length < before) { this.save(); return true }
    return false
  }

  enable(id: string): void {
    const s = this.schedules.find(s => s.id === id)
    if (s) { s.enabled = true; s.nextRun = Date.now() + s.interval; this.save() }
  }

  disable(id: string): void {
    const s = this.schedules.find(s => s.id === id)
    if (s) { s.enabled = false; this.save() }
  }

  markRun(id: string): void {
    const s = this.schedules.find(s => s.id === id)
    if (s) { s.lastRun = Date.now(); s.nextRun = Date.now() + s.interval; this.save() }
  }

  getDue(): Schedule[] {
    const now = Date.now()
    return this.schedules.filter(s => s.enabled && s.nextRun <= now)
  }

  list(): Schedule[] {
    return [...this.schedules]
  }

  get(id: string): Schedule | undefined {
    return this.schedules.find(s => s.id === id)
  }
}

/** Parse human interval string to milliseconds: "1h", "30m", "2h30m", "1d" */
export function parseInterval(str: string): number | null {
  let total = 0
  const re = /(\d+)\s*(d|h|m|s)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(str)) !== null) {
    const val = parseInt(match[1])
    switch (match[2].toLowerCase()) {
      case 'd': total += val * 86400000; break
      case 'h': total += val * 3600000; break
      case 'm': total += val * 60000; break
      case 's': total += val * 1000; break
    }
  }
  return total > 0 ? total : null
}

/** Format milliseconds to human string */
export function formatInterval(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return `${Math.floor(ms / 1000)}s`
}
```

- [ ] **Step 3: Commit**

```bash
git add src/scheduler/types.ts src/scheduler/scheduleStore.ts
git commit -m "feat: add ScheduleStore with interval parsing and persistence"
```

---

### Task 4: Scheduler — Timer Loop That Dispatches Teams

**Files:**
- Create: `src/scheduler/scheduler.ts`

- [ ] **Step 1: Implement Scheduler**

```typescript
import { ScheduleStore, formatInterval } from './scheduleStore.js'
import { AgentStore } from '../agents/agentStore.js'
import type { TeamTemplate } from '../agents/types.js'
import { getAgentType } from '../tools/agentTypes.js'
import { theme } from '../ui/theme.js'
import { getLayout } from '../ui/fullscreen.js'

export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private scheduleStore: ScheduleStore
  private agentStore: AgentStore
  private runTeamFn: (template: TeamTemplate, workingDir: string) => Promise<void>

  constructor(
    scheduleStore: ScheduleStore,
    agentStore: AgentStore,
    runTeamFn: (template: TeamTemplate, workingDir: string) => Promise<void>,
  ) {
    this.scheduleStore = scheduleStore
    this.agentStore = agentStore
    this.runTeamFn = runTeamFn
  }

  /** Start the background scheduler loop (checks every 30s) */
  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => this.tick(), 30_000)
    // Also check immediately
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  isRunning(): boolean {
    return this.running
  }

  private async tick(): Promise<void> {
    const due = this.scheduleStore.getDue()
    for (const schedule of due) {
      const template = this.agentStore.loadTeam(schedule.team)
      if (!template) {
        getLayout().log(theme.warning(`Schedule "${schedule.id}": team "${schedule.team}" not found, skipping.`))
        this.scheduleStore.markRun(schedule.id)
        continue
      }

      const workingDir = schedule.workingDir || template.workingDir || process.cwd()
      getLayout().log(theme.info(`[Scheduler] Running team "${schedule.team}" (${formatInterval(schedule.interval)} interval)`))
      this.scheduleStore.markRun(schedule.id)

      // Fire and forget — don't block the tick loop
      this.runTeamFn(template, workingDir).catch(err => {
        getLayout().log(theme.error(`[Scheduler] Team "${schedule.team}" failed: ${(err as Error).message}`))
      })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scheduler/scheduler.ts
git commit -m "feat: add Scheduler timer loop for dispatching team runs"
```

---

### Task 5: Wire AgentStore Into Agent Execution

**Files:**
- Modify: `src/tools/agentTypes.ts` — add `fromDefinition()` helper
- Modify: `src/team/teamTools.ts` — load agent definitions when creating teams

- [ ] **Step 1: Add `fromDefinition()` to agentTypes.ts**

Add this function at the bottom of `src/tools/agentTypes.ts`:

```typescript
import type { AgentDefinition } from '../agents/types.js'
import { AgentStore } from '../agents/agentStore.js'

/** Build an AgentType from a persistent AgentDefinition, merging instruction files into the system prompt */
export function fromDefinition(def: AgentDefinition): AgentType {
  const base = getAgentType(def.agentType) || AGENT_TYPES[0]
  const store = new AgentStore()
  const fullPrompt = store.buildSystemPrompt(def, base.systemPrompt)

  return {
    name: def.name,
    description: def.description,
    systemPrompt: fullPrompt,
    allowedTools: def.tools || base.allowedTools,
    readOnly: base.readOnly,
    model: def.model,
    provider: def.provider,
  }
}
```

- [ ] **Step 2: Update TeamCreate in teamTools.ts**

In `src/team/teamTools.ts`, in the TeamCreate tool handler, add agent definition loading. Before calling `runSubAgent()` for each worker, check if the worker name matches a persistent agent definition and use its prompt/config if so.

Find the section where workers are iterated and sub-agents launched. Add this logic before the `runSubAgent` call:

```typescript
// At the top of teamTools.ts, add import:
import { AgentStore } from '../agents/agentStore.js'
import { fromDefinition } from './agentTypes.js'

// Inside TeamCreate handler, when building each worker's config:
const agentStore = new AgentStore()
const agentDef = agentStore.loadAgent(workerDef.name)
if (agentDef) {
  // Use persistent agent definition — its AGENT.md/SOUL.md/MEMORY.md are loaded
  const agentType = fromDefinition(agentDef)
  // Pass agentType.systemPrompt as the worker's system prompt
  // Pass agentType.model, agentType.provider as overrides
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/agentTypes.ts src/team/teamTools.ts
git commit -m "feat: wire persistent agent definitions into team worker execution"
```

---

### Task 6: /agents Command

**Files:**
- Create: `src/commands/agents.ts`
- Modify: `src/repl.ts` — register the command and handle results

- [ ] **Step 1: Create agents command**

```typescript
import type { Command, CommandContext, CommandResult } from './types.js'
import { AgentStore } from '../agents/agentStore.js'
import { theme } from '../ui/theme.js'

export const agentsCommand: Command = {
  name: 'agents',
  description: 'Manage persistent agent definitions',
  usage: '/agents [list|show <name>|create <name>|delete <name>]',

  async run(args: string, ctx: CommandContext): Promise<CommandResult> {
    const store = new AgentStore()
    const [sub, ...rest] = args.trim().split(/\s+/)
    const name = rest.join(' ')

    if (!sub || sub === 'list') {
      const agents = store.listAgents()
      if (agents.length === 0) return { type: 'output', text: theme.dim('No agents defined. Use /agents create <name> to create one.') }
      const lines = agents.map(a => {
        const def = store.loadAgent(a)
        const hasAgent = def?.agentMd ? '  AGENT.md' : ''
        const hasSoul = def?.soulMd ? '  SOUL.md' : ''
        const hasMem = def?.memoryMd ? '  MEMORY.md' : ''
        return `  ${theme.info(a)} ${theme.dim(`(${def?.agentType || 'general-purpose'})`)}${theme.dim(hasAgent + hasSoul + hasMem)}`
      })
      return { type: 'output', text: theme.bold('Agents:\n') + lines.join('\n') }
    }

    if (sub === 'show') {
      if (!name) return { type: 'output', text: theme.error('Usage: /agents show <name>') }
      const def = store.loadAgent(name)
      if (!def) return { type: 'output', text: theme.error(`Agent "${name}" not found.`) }
      const lines = [
        theme.bold(def.name),
        `  ${theme.dim('Type:')} ${def.agentType}`,
        def.model ? `  ${theme.dim('Model:')} ${def.model}` : '',
        def.provider ? `  ${theme.dim('Provider:')} ${def.provider}` : '',
        def.tools ? `  ${theme.dim('Tools:')} ${def.tools.join(', ')}` : '',
        def.agentMd ? `\n${theme.dim('── AGENT.md ──')}\n${def.agentMd}` : '',
        def.soulMd ? `\n${theme.dim('── SOUL.md ──')}\n${def.soulMd}` : '',
        def.memoryMd ? `\n${theme.dim('── MEMORY.md ──')}\n${def.memoryMd}` : '',
      ].filter(Boolean)
      return { type: 'output', text: lines.join('\n') }
    }

    if (sub === 'create') {
      if (!name) return { type: 'output', text: theme.error('Usage: /agents create <name>') }
      if (store.loadAgent(name)) return { type: 'output', text: theme.error(`Agent "${name}" already exists.`) }
      store.saveAgent({
        name,
        description: `${name} agent`,
        agentType: 'general-purpose',
      })
      return { type: 'output', text: theme.success(`Agent "${name}" created at ~/.autocli/agents/${name}/\n`) +
        theme.dim('Edit these files to customize:\n') +
        `  ${theme.info('AGENT.md')} — role, goals, constraints\n` +
        `  ${theme.info('SOUL.md')}  — personality, decision style\n` +
        `  ${theme.info('MEMORY.md')} — accumulated learnings` }
    }

    if (sub === 'delete') {
      if (!name) return { type: 'output', text: theme.error('Usage: /agents delete <name>') }
      if (!store.deleteAgent(name)) return { type: 'output', text: theme.error(`Agent "${name}" not found.`) }
      return { type: 'output', text: theme.success(`Agent "${name}" deleted.`) }
    }

    return { type: 'output', text: theme.error(`Unknown subcommand: ${sub}. Use list, show, create, or delete.`) }
  },
}
```

- [ ] **Step 2: Register in repl.ts**

Add import and register:

```typescript
import { agentsCommand } from './commands/agents.js'
// In the command registration block:
commandRegistry.register(agentsCommand)
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/agents.ts src/repl.ts
git commit -m "feat: add /agents command for managing persistent agent definitions"
```

---

### Task 7: /schedule Command

**Files:**
- Create: `src/commands/schedule.ts`
- Modify: `src/repl.ts` — register and handle schedule results

- [ ] **Step 1: Create schedule command**

```typescript
import type { Command, CommandContext, CommandResult } from './types.js'
import { ScheduleStore, parseInterval, formatInterval } from '../scheduler/scheduleStore.js'
import { AgentStore } from '../agents/agentStore.js'
import { theme } from '../ui/theme.js'

export const scheduleCommand: Command = {
  name: 'schedule',
  description: 'Manage scheduled team runs',
  usage: '/schedule [list|add <team> <interval>|remove <id>|enable <id>|disable <id>|run <team>]',

  async run(args: string, ctx: CommandContext): Promise<CommandResult> {
    const store = new ScheduleStore()
    const agentStore = new AgentStore()
    const [sub, ...rest] = args.trim().split(/\s+/)

    if (!sub || sub === 'list') {
      const schedules = store.list()
      if (schedules.length === 0) return { type: 'output', text: theme.dim('No schedules. Use /schedule add <team> <interval>') }
      const lines = schedules.map(s => {
        const status = s.enabled ? theme.success('●') : theme.dim('○')
        const last = s.lastRun ? new Date(s.lastRun).toLocaleString() : 'never'
        const next = s.enabled ? new Date(s.nextRun).toLocaleString() : 'disabled'
        return `  ${status} ${theme.info(s.id)} ${s.team} every ${formatInterval(s.interval)}\n    ${theme.dim(`last: ${last}  next: ${next}`)}`
      })
      return { type: 'output', text: theme.bold('Schedules:\n') + lines.join('\n') }
    }

    if (sub === 'add') {
      if (rest.length < 2) return { type: 'output', text: theme.error('Usage: /schedule add <team> <interval>\nExample: /schedule add code-review 1h') }
      const teamName = rest[0]
      const intervalStr = rest.slice(1).join(' ')
      const intervalMs = parseInterval(intervalStr)
      if (!intervalMs) return { type: 'output', text: theme.error(`Invalid interval: "${intervalStr}". Use format like 1h, 30m, 2h30m, 1d`) }
      const template = agentStore.loadTeam(teamName)
      if (!template) return { type: 'output', text: theme.error(`Team "${teamName}" not found. Create it first with the TeamCreate tool or save a team template.`) }
      const schedule = store.add(teamName, intervalMs, ctx.workingDir)
      return { type: 'output', text: theme.success(`Scheduled "${teamName}" every ${formatInterval(intervalMs)}\n`) + theme.dim(`ID: ${schedule.id}  Next run: ${new Date(schedule.nextRun).toLocaleString()}`) }
    }

    if (sub === 'remove') {
      const id = rest[0]
      if (!id) return { type: 'output', text: theme.error('Usage: /schedule remove <id>') }
      if (!store.remove(id)) return { type: 'output', text: theme.error(`Schedule "${id}" not found.`) }
      return { type: 'output', text: theme.success(`Schedule "${id}" removed.`) }
    }

    if (sub === 'enable') {
      const id = rest[0]
      if (!id) return { type: 'output', text: theme.error('Usage: /schedule enable <id>') }
      store.enable(id)
      return { type: 'output', text: theme.success(`Schedule "${id}" enabled.`) }
    }

    if (sub === 'disable') {
      const id = rest[0]
      if (!id) return { type: 'output', text: theme.error('Usage: /schedule disable <id>') }
      store.disable(id)
      return { type: 'output', text: theme.success(`Schedule "${id}" disabled.`) }
    }

    if (sub === 'run') {
      const teamName = rest[0]
      if (!teamName) return { type: 'output', text: theme.error('Usage: /schedule run <team>') }
      return { type: 'run_team', team: teamName, workingDir: ctx.workingDir }
    }

    return { type: 'output', text: theme.error(`Unknown subcommand: ${sub}`) }
  },
}
```

- [ ] **Step 2: Add `run_team` result type to commands/types.ts**

Add to the CommandResult union:

```typescript
| { type: 'run_team'; team: string; workingDir: string }
```

- [ ] **Step 3: Register in repl.ts and handle `run_team` result**

```typescript
import { scheduleCommand } from './commands/schedule.js'
commandRegistry.register(scheduleCommand)

// In the result handling switch:
} else if (result.type === 'run_team') {
  const { AgentStore } = await import('./agents/agentStore.js')
  const agentStore = new AgentStore()
  const template = agentStore.loadTeam(result.team)
  if (!template) {
    layout.log(theme.error(`Team "${result.team}" not found.`))
  } else {
    layout.log(theme.info(`Running team "${result.team}"...`))
    // Dispatch as a prompt so the LLM orchestrates it
    const teamPrompt = `Run the team "${template.name}" with goal: ${template.goal}\n\nAgents:\n${template.agents.map(a => `- ${a.agentName}: ${a.task}`).join('\n')}`
    messages.push({ role: 'user', content: teamPrompt })
  }
  continue
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/schedule.ts src/commands/types.ts src/repl.ts
git commit -m "feat: add /schedule command for managing recurring team runs"
```

---

### Task 8: Wire Scheduler Into REPL + Headless + CLI

**Files:**
- Modify: `src/repl.ts` — start scheduler as background thread
- Modify: `src/remote/headless.ts` — start scheduler in daemon mode
- Modify: `src/index.ts` — add `--scheduler` and `--run-team` flags

- [ ] **Step 1: Add scheduler to REPL (background thread)**

In `src/repl.ts`, after engine initialization but before the REPL loop:

```typescript
import { ScheduleStore } from './scheduler/scheduleStore.js'
import { Scheduler } from './scheduler/scheduler.js'
import { AgentStore } from './agents/agentStore.js'

const agentStore = new AgentStore()
const scheduleStore = new ScheduleStore()
const scheduler = new Scheduler(scheduleStore, agentStore, async (template, wd) => {
  // Build team from template and run via TeamManager
  const workers = template.agents.map(a => {
    const def = agentStore.loadAgent(a.agentName)
    return { name: a.agentName, task: a.task, agentType: def?.agentType || 'general-purpose', model: def?.model }
  })
  const team = teamManager.createTeam(template.name, template.goal, workers)
  layout.log(theme.info(`[Scheduler] Team "${template.name}" started (${team.workers.length} workers)`))

  // Launch workers as sub-agents
  for (const worker of team.workers) {
    teamManager.startWorker(team.id, worker.id)
    const def = agentStore.loadAgent(worker.name)
    const sysPrompt = def ? agentStore.buildSystemPrompt(def) : undefined
    ;(async () => {
      try {
        const { runSubAgent } = await import('./engine/queryEngine.js')
        const result = await runSubAgent(
          `${sysPrompt ? sysPrompt + '\n\n' : ''}Task: ${worker.task}`,
          worker.name,
          { workingDir: wd, sharedState: {} },
          { subagentType: worker.agentType, model: worker.model },
        )
        teamManager.completeWorker(team.id, worker.id, result)
      } catch (err) {
        teamManager.failWorker(team.id, worker.id, (err as Error).message)
      }
    })()
  }
})

// Start scheduler if there are any enabled schedules
if (scheduleStore.list().some(s => s.enabled)) {
  scheduler.start()
  layout.log(theme.dim(`Scheduler active (${scheduleStore.list().filter(s => s.enabled).length} schedules)`))
}
```

- [ ] **Step 2: Add `--scheduler` flag to index.ts**

```typescript
else if (arg === '--scheduler') { flags.scheduler = true }
else if (arg === '--run-team') { flags.runTeam = args[++i] }
```

And in `main()`:

```typescript
if (flags.scheduler) {
  // Standalone scheduler daemon
  const { AgentStore } = await import('./agents/agentStore.js')
  const { ScheduleStore } = await import('./scheduler/scheduleStore.js')
  const { Scheduler } = await import('./scheduler/scheduler.js')
  // ... setup engine, scheduler, run loop
  console.log(theme.info('Scheduler daemon started. Press Ctrl+C to stop.'))
  await new Promise(() => {}) // block forever
  return
}

if (flags.runTeam) {
  // One-shot team execution (for external cron)
  const { AgentStore } = await import('./agents/agentStore.js')
  const agentStore = new AgentStore()
  const template = agentStore.loadTeam(flags.runTeam as string)
  if (!template) { console.error(theme.error(`Team "${flags.runTeam}" not found.`)); process.exit(1) }
  // ... setup engine, run team, exit
  return
}
```

- [ ] **Step 3: Commit**

```bash
git add src/repl.ts src/remote/headless.ts src/index.ts
git commit -m "feat: wire scheduler into REPL background, headless daemon, and CLI flags"
```

---

### Task 9: Team Save Command (Save Current Team as Template)

**Files:**
- Modify: `src/commands/team.ts` — add `save` subcommand

- [ ] **Step 1: Extend /team command**

Add `/team save <name>` that takes the currently active team and persists it as a TeamTemplate:

```typescript
if (sub === 'save') {
  const agentStore = new AgentStore()
  const activeTeam = teamManager.getActiveTeam()
  if (!activeTeam) return { type: 'output', text: theme.error('No active team to save.') }
  const template: TeamTemplate = {
    name: saveName || activeTeam.name,
    goal: activeTeam.goal,
    agents: activeTeam.workers.map(w => ({ agentName: w.name, task: w.task })),
    workingDir: ctx.workingDir,
  }
  agentStore.saveTeam(template)
  return { type: 'output', text: theme.success(`Team saved as "${template.name}"`) }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/team.ts
git commit -m "feat: add /team save to persist active team as reusable template"
```

---

## Summary

| Task | What it builds | Files |
|------|---------------|-------|
| 1 | Type definitions | `src/agents/types.ts` |
| 2 | AgentStore (CRUD + instruction file loading) | `src/agents/agentStore.ts` |
| 3 | ScheduleStore + interval parsing | `src/scheduler/types.ts`, `src/scheduler/scheduleStore.ts` |
| 4 | Scheduler timer loop | `src/scheduler/scheduler.ts` |
| 5 | Wire agent definitions into execution | `src/tools/agentTypes.ts`, `src/team/teamTools.ts` |
| 6 | /agents command | `src/commands/agents.ts`, `src/repl.ts` |
| 7 | /schedule command | `src/commands/schedule.ts`, `src/commands/types.ts`, `src/repl.ts` |
| 8 | Wire scheduler into REPL + headless + CLI | `src/repl.ts`, `src/remote/headless.ts`, `src/index.ts` |
| 9 | /team save command | `src/commands/team.ts` |
