#!/usr/bin/env bun

import path from 'path'
import { theme } from './cli/ui/theme.js'
import { platform } from './utils/platform.js'
import type { LLMProvider, Message } from './services/providers/types.js'
import type { AgentResult } from './stores/jobResultStore.js'

const VERSION = '0.2.3'

// Known subcommands — if argv[2] matches one of these, route to it
const SUBCOMMANDS = new Set([
  'help', 'review', 'doctor', 'skills',
  'brain', 'agents', 'activate', 'schedule', 'deploy', 'permissions',
  'perms', 'status', 'tasks', 'team', 'cost', 'plan', 'yolo',
])

function parseArgs() {
  const rawArgs = process.argv.slice(2)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (arg === '--help' || arg === '-h') { flags.help = true }
    else if (arg === '--version' || arg === '-v') { flags.version = true }
    else if (arg === '--resume' || arg === '-r') { flags.resume = rawArgs[++i] || 'latest' }
    else if (arg === '--prompt') { flags.prompt = rawArgs[++i] || '' }
    else if (arg === '--model' || arg === '-m') { flags.model = rawArgs[++i] || '' }
    else if (arg === '--set-key') { flags.setKey = rawArgs[++i] || '' }
    else if (arg === '--provider') { flags.provider = rawArgs[++i] || '' }
    else if (arg === '--scheduler') { flags.scheduler = true }
    else if (arg === '--run-team') { flags.runTeam = rawArgs[++i] || '' }
    else if (arg === '--yolo') { flags.yolo = true }
    else if (arg === '--plan') { flags.plan = true }
    else if (arg === '--staged' || arg === '-s') { positional.push(arg) }
    else if (!arg.startsWith('-')) { positional.push(arg) }
  }
  return { flags, positional }
}

function showHelp() {
  console.log(`
${theme.bold('autocli')} v${VERSION} — A minimal AI coding assistant

${theme.bold('Usage:')}
  autocli "prompt"              One-shot query
  autocli <command> [args]      Run a command
  autocli --resume [id]         Resume interactive session

${theme.bold('Commands:')}
  help                          Show this help
  review [--staged|PR#]         LLM code review
  doctor                        Diagnose environment issues
  brain [stats|search|show|sync] Second Brain management
  skills                        List available skills
  agents [list|show|create|delete] <name>  Manage agents
  activate [key]                Activate license key
  schedule [list|add|remove|enable|disable|run|results] Manage schedules
  deploy <blueprint.md>         Deploy team from blueprint
  permissions [allow|deny|mode|reset|remove] Manage permissions
  status                        Show teams, tasks, schedules
  tasks                         List background tasks
  team [save <name>]            Show/save team status

${theme.bold('Options:')}
  -h, --help                    Show this help
  -v, --version                 Show version
  -r, --resume [id]             Resume session (latest if no id)
  -m, --model <model>           Model (sonnet, opus, haiku, minimax)
  --provider <name>             Provider (openai, claude-local, minimaxi-cn)
  --set-key <key>               Save API key
  --yolo                        Auto-approve all tool calls
  --plan                        Read-only mode (no write tools)
  --scheduler                   Run as scheduler daemon
  --run-team <name>             Run a team template once
`)
}

async function main() {
  const { flags, positional } = parseArgs()

  if (flags.version) {
    console.log(`autocli v${VERSION}`)
    process.exit(0)
  }

  // Check if first positional is a subcommand
  const subcommand = positional[0] && SUBCOMMANDS.has(positional[0]) ? positional[0] : null
  const subArgs = subcommand ? positional.slice(1).join(' ') : ''

  if (flags.help || subcommand === 'help') {
    showHelp()
    process.exit(0)
  }

  // If no subcommand and no prompt and no flags, treat as wanting help or REPL
  if (!subcommand && !flags.prompt && positional.length === 0 && !flags.resume && !flags.scheduler && !flags.runTeam && process.stdin.isTTY) {
    // Start REPL (handled below after init)
  }

  // If first positional is not a subcommand, treat it as a prompt
  if (!subcommand && positional.length > 0 && !flags.prompt) {
    flags.prompt = positional.join(' ')
  }

  // ── Auto-init .claude/ and CLAUDE.md (only for prompt/REPL, not read-only subcommands) ──
  if (!subcommand || subcommand === 'review') {
    const { existsSync, mkdirSync, writeFileSync } = await import('fs')
    const cwd = process.cwd()
    const claudeDir = path.join(cwd, '.claude')
    if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true })
    if (!existsSync(path.join(claudeDir, 'skills'))) mkdirSync(path.join(claudeDir, 'skills'), { recursive: true })
    if (!existsSync(path.join(cwd, 'CLAUDE.md'))) {
      writeFileSync(path.join(cwd, 'CLAUDE.md'), `# Project Instructions\n\n<!-- Add project-specific instructions for the AI assistant here. -->\n\n## Code Style\n-\n\n## Testing\n-\n\n## Architecture\n-\n`)
    }
    if (!existsSync(path.join(claudeDir, 'CLAUDE.md'))) {
      writeFileSync(path.join(claudeDir, 'CLAUDE.md'), `# Claude Configuration\n\n<!-- Project-level Claude configuration. -->\n`)
    }
  }

  // ── Initialize database ──
  const dbPath = path.join(platform.configDir, 'autocli.db')
  const { initDatabase } = await import('./stores/db.js')
  initDatabase(dbPath)

  // ── Create stores ──
  const { SessionStore } = await import('./stores/sessionStore.js')
  const { MemoryStore } = await import('./stores/memoryStore.js')
  const { BrainStore } = await import('./stores/brainStore.js')
  const { TaskStore } = await import('./stores/taskStore.js')
  const { AgentStore } = await import('./stores/agentStore.js')
  const { ScheduleStore } = await import('./stores/scheduleStore.js')
  const { JobResultStore } = await import('./stores/jobResultStore.js')
  const { ConfigStore } = await import('./stores/configStore.js')

  const sessionStore = new SessionStore()
  const memoryStore = new MemoryStore(path.join(platform.configDir, 'memory'))
  const brainStore = new BrainStore(path.join(platform.configDir, 'brain'))
  const taskStore = new TaskStore()
  const agentStore = new AgentStore(path.join(platform.configDir, 'agents'))
  const scheduleStore = new ScheduleStore()
  const jobResultStore = new JobResultStore()
  const configStore = new ConfigStore()

  // ── Load config ──
  const config = await configStore.load()

  if (flags.setKey) {
    config.openaiApiKey = flags.setKey as string
    await configStore.save(config)
    console.log(theme.success('API key saved.'))
    process.exit(0)
  }

  await memoryStore.sync()
  await brainStore.sync()

  // ── Resolve model & provider ──
  const { resolveModel, resolveProvider, getApiKey } = await import('./utils/config.js')
  const resolvedModel = flags.model ? resolveModel(flags.model as string) : config.model
  const providerName = resolveProvider(resolvedModel, config)
  const apiKey = getApiKey(providerName, config)

  // ── Handle subcommands that don't need the engine ──
  if (subcommand) {
    const workingDir = process.cwd()
    const cmdContext = {
      workingDir,
      sessionId: '',
      messages: [] as Message[],
      model: resolvedModel,
      totalTokens: { input: 0, output: 0 },
      totalCost: 0,
    }

    // Commands that just print output
    const directCommands: Record<string, () => Promise<void>> = {
      doctor: async () => {
        const { doctorCommand } = await import('./cli/commands/doctor.js')
        const result = await doctorCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
      },
      skills: async () => {
        const { skillsCommand } = await import('./cli/commands/skills.js')
        const result = await skillsCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
      },
      brain: async () => {
        const { brainCommand } = await import('./cli/commands/brain.js')
        const result = await brainCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
      },
      agents: async () => {
        const { agentsCommand } = await import('./cli/commands/agents.js')
        const result = await agentsCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
      },
      activate: async () => {
        const { activateCommand } = await import('./cli/commands/activate.js')
        const result = await activateCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
      },
      schedule: async () => {
        const { scheduleCommand } = await import('./cli/commands/schedule.js')
        const result = await scheduleCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
        if (result.type === 'run_team') {
          console.log(theme.dim('Use --run-team flag to execute a team.'))
        }
      },
      deploy: async () => {
        const { deployCommand } = await import('./cli/commands/deploy.js')
        const result = await deployCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
      },
      permissions: async () => {
        const { permissionsCommand } = await import('./cli/commands/permissions.js')
        const result = await permissionsCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
        if (result.type === 'permissions_show') {
          console.log(`Permission mode: ${config.permissionMode || 'default'}`)
        }
      },
      perms: async () => { await directCommands.permissions() },
      tasks: async () => {
        console.log(theme.dim('No background tasks (tasks are only tracked within a session).'))
      },
      status: async () => {
        const schedules = scheduleStore.list()
        if (schedules.length > 0) {
          console.log(theme.bold('Schedules:'))
          for (const s of schedules) {
            const icon = s.enabled ? theme.success('●') : theme.dim('○')
            console.log(`  ${icon} ${theme.info(s.teamName)} every ${s.interval} ${theme.dim(s.enabled ? 'enabled' : 'disabled')}`)
          }
        } else {
          console.log(theme.dim('No schedules.'))
        }
        const agents = agentStore.list()
        if (agents.length > 0) {
          console.log('')
          console.log(theme.bold('Agents:'))
          for (const a of agents) {
            console.log(`  ${theme.info(a.name)} ${theme.dim(`(${a.type})`)}`)
          }
        }
      },
      team: async () => {
        const { teamCommand } = await import('./cli/commands/team.js')
        const result = await teamCommand.execute(subArgs, cmdContext)
        if (result.output) console.log(result.output)
        if (result.type === 'team_status') {
          console.log(theme.dim('No active teams (teams are only active within a session).'))
        }
      },
      plan: async () => {
        console.log(theme.dim('Plan mode is a session flag. Use: autocli --plan "prompt"'))
      },
      yolo: async () => {
        console.log(theme.dim('YOLO mode is a session flag. Use: autocli --yolo "prompt"'))
      },
    }

    // Commands that send a prompt to the engine
    const promptCommands = new Set(['review'])

    if (promptCommands.has(subcommand)) {
      // These need the full engine — fall through to engine init below
    } else if (directCommands[subcommand]) {
      await directCommands[subcommand]()
      process.exit(0)
    }
  }

  // ── Create EventBus ──
  const { EventBus } = await import('./services/events/eventBus.js')
  const eventBus = new EventBus()

  // ── Create provider ──
  const { OpenAIProvider } = await import('./services/providers/openai.js')
  const { MinimaXIProvider } = await import('./services/providers/minimaxi.js')
  const { ClaudeLocalBridge } = await import('./services/providers/claudeLocal.js')

  let provider: LLMProvider
  switch (providerName) {
    case 'minimaxi-cn':
      provider = new MinimaXIProvider({
        apiKey: config.minimaxiApiKey || process.env.MINIMAXI_API_KEY || '',
        baseUrl: config.minimaxiBaseUrl,
        model: config.minimaxiModel,
      })
      break
    case 'claude-local':
      provider = new ClaudeLocalBridge({
        command: config.claudeLocalCommand,
        args: config.claudeLocalArgs,
        model: resolvedModel,
      })
      break
    default:
      provider = new OpenAIProvider({
        apiKey: apiKey || '',
        baseUrl: config.openaiBaseUrl,
        model: resolvedModel,
      })
  }

  // ── Create PermissionGate, HookRunner ──
  const { PermissionGate } = await import('./services/permissions/permissionGate.js')
  const { promptPermission } = await import('./cli/ui/permissionPrompt.js')
  const permissionGate = new PermissionGate(
    flags.yolo ? 'auto-approve' : config.permissionMode,
    eventBus,
    async (toolName, input) => {
      const desc = `${toolName}: ${JSON.stringify(input).slice(0, 200)}`
      const answer = await promptPermission(toolName, desc)
      if (answer === 'always') permissionGate.addAlwaysAllow(toolName)
      return answer === 'yes' || answer === 'always'
    },
    provider,
  )

  const { HookRunner } = await import('./services/hooks/hookRunner.js')
  const hookRunner = new HookRunner(config.hooks, eventBus)

  // ── Create TeamManager, SkillLoader, ToolRegistry ──
  const { TeamManager } = await import('./services/teams/teamManager.js')
  const teamManager = new TeamManager()

  const { SkillLoader } = await import('./services/skills/loader.js')
  const skillLoader = new SkillLoader([
    path.join(platform.configDir, 'skills'),
    path.join(process.cwd(), 'skills'),
  ])

  const { ToolRegistry } = await import('./services/tools/registry.js')
  const { registerAllTools } = await import('./services/tools/registerAll.js')
  const toolRegistry = new ToolRegistry()
  registerAllTools(toolRegistry, brainStore, taskStore, teamManager, agentStore, skillLoader)

  // ── Create engine components ──
  const { TokenCounter } = await import('./services/engine/tokenCounter.js')
  const { ContextManager } = await import('./services/engine/contextManager.js')
  const { PromptBuilder } = await import('./services/engine/promptBuilder.js')

  const tokenCounter = new TokenCounter(resolvedModel)
  const contextManager = new ContextManager()
  const promptBuilder = new PromptBuilder(memoryStore, brainStore)

  // ── Create ToolExecutor, QueryEngine ──
  const { ToolExecutor } = await import('./services/engine/toolExecutor.js')
  const { QueryEngine } = await import('./services/engine/queryEngine.js')

  const toolExecutor = new ToolExecutor(toolRegistry, permissionGate, eventBus)
  const engine = new QueryEngine({
    provider,
    toolRegistry,
    toolExecutor,
    contextManager,
    tokenCounter,
    promptBuilder,
    eventBus,
    maxTokens: config.maxTokens,
    model: resolvedModel,
    maxSessionCost: config.maxSessionCost,
  })

  // ── Create TemplateLoader, Scheduler ──
  const { TemplateLoader } = await import('./services/teams/templateLoader.js')
  const { Scheduler } = await import('./services/scheduler/scheduler.js')
  const { BackgroundTaskManager } = await import('./services/engine/backgroundTask.js')

  const templateLoader = new TemplateLoader([path.join(platform.configDir, 'teams')])
  const bgTaskManager = new BackgroundTaskManager()

  const runTeamFn = async (teamName: string, wd?: string): Promise<AgentResult[]> => {
    const template = templateLoader.get(teamName)
    if (!template) throw new Error(`Team template "${teamName}" not found`)
    const results: AgentResult[] = []
    const teamWd = wd || process.cwd()
    // Provide sharedState so sub-agents can use Agent, AskUser, background Bash
    const teamSharedState: Record<string, unknown> = {
      backgroundTaskManager: bgTaskManager,
      runSubAgent: async (prompt: string, _opts?: any): Promise<string> => {
        const subMsgs: Message[] = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
        let output = ''
        const r = await engine.run(subMsgs, teamWd, (text) => { output += text })
        return output || r.response.content.filter(b => b.type === 'text').map(b => b.text || '').join('')
      },
    }
    for (const agent of template.agents) {
      try {
        const sysPrompt = await agentStore.buildSystemPrompt(agent.name)
        const prompt = sysPrompt ? `${sysPrompt}\n\nTask: run team agent "${agent.name}"` : `Run team agent "${agent.name}"`
        const msgs: Message[] = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
        await engine.run(msgs, teamWd, undefined, teamSharedState)
        results.push({ name: agent.name, status: 'success', result: 'completed' })
      } catch (e) {
        results.push({ name: agent.name, status: 'failed', error: String(e) })
      }
    }
    return results
  }

  const scheduler = new Scheduler(scheduleStore, jobResultStore, runTeamFn)

  // ── Handle prompt-type subcommands (need engine) ──
  if (subcommand === 'review') {
    const m = await import('./cli/commands/review.js')
    const cmd = m.reviewCommand
    const result = await cmd.execute(subArgs, {
      workingDir: process.cwd(),
      sessionId: '',
      messages: [],
      model: resolvedModel,
    })
    if (result.output) console.log(result.output)
    if (result.type === 'prompt' && result.prompt) {
      const messages: Message[] = [
        { role: 'user', content: [{ type: 'text', text: result.prompt }] },
      ]
      const sharedState: Record<string, unknown> = {
        planMode: !!flags.plan,
        backgroundTaskManager: bgTaskManager,
      }
      try {
        await engine.run(messages, process.cwd(), (text) => process.stdout.write(text), sharedState)
      } catch (err) {
        console.error(theme.error((err as Error).message))
        process.exit(1)
      }
      console.log()
      console.log(theme.dim(tokenCounter.format()))
    }
    process.exit(0)
  }

  // ── Handle --scheduler mode ──
  if (flags.scheduler) {
    const active = scheduleStore.list().filter(s => s.enabled)
    if (active.length === 0) {
      console.log(theme.warning('No enabled schedules found.'))
      process.exit(0)
    }
    scheduler.start()
    console.log(theme.info(`Scheduler daemon started with ${active.length} schedule(s). Press Ctrl+C to stop.`))
    await new Promise(() => {})
    return
  }

  // ── Handle --run-team mode ──
  if (flags.runTeam) {
    const teamName = flags.runTeam as string
    const template = templateLoader.get(teamName)
    if (!template) {
      console.error(theme.error(`Team "${teamName}" not found.`))
      process.exit(1)
    }
    console.log(theme.info(`Running team "${template.name}"...`))
    console.log(theme.dim(`Goal: ${template.goal}`))
    console.log(theme.dim(`Agents: ${template.agents.map(a => a.name).join(', ')}`))
    try {
      const agentResults = await runTeamFn(teamName, process.cwd())
      const failed = agentResults.filter(r => r.status === 'failed')
      if (failed.length > 0) {
        for (const f of failed) console.error(theme.error(`[Agent] Failed: ${f.error}`))
      }
      console.log(theme.success(`Team "${template.name}" completed.`))
    } catch (err) {
      console.error(theme.error(`Team "${template.name}" failed: ${(err as Error).message}`))
      process.exit(1)
    }
    process.exit(0)
  }

  // ── Read piped stdin ──
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer)
    }
    const stdinContent = Buffer.concat(chunks).toString('utf-8').trim()
    if (stdinContent) {
      const existingPrompt = (flags.prompt as string) || ''
      flags.prompt = existingPrompt
        ? `${existingPrompt}\n\n<stdin>\n${stdinContent}\n</stdin>`
        : stdinContent
    }
  }

  // ── Handle one-shot prompt ──
  if (flags.prompt) {
    const prompt = flags.prompt as string
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ]
    const sharedState: Record<string, unknown> = {
      planMode: !!flags.plan,
      backgroundTaskManager: bgTaskManager,
    }
    try {
      await engine.run(messages, process.cwd(), (text) => process.stdout.write(text), sharedState)
    } catch (err) {
      console.error(theme.error((err as Error).message))
      process.exit(1)
    }
    console.log()
    console.log(theme.dim(tokenCounter.format()))
    return
  }

  // ── Start interactive REPL ──
  const { CommandRegistry } = await import('./cli/commands/registry.js')
  const commandRegistry = new CommandRegistry()

  const { helpCommand } = await import('./cli/commands/help.js')
  const { planCommand } = await import('./cli/commands/plan.js')
  const { yoloCommand } = await import('./cli/commands/yolo.js')
  const { reviewCommand } = await import('./cli/commands/review.js')
  const { brainCommand } = await import('./cli/commands/brain.js')
  const { tasksCommand } = await import('./cli/commands/tasks.js')
  const { skillsCommand } = await import('./cli/commands/skills.js')
  const { permissionsCommand } = await import('./cli/commands/permissions.js')
  const { statusCommand } = await import('./cli/commands/status.js')

  const { activateCommand } = await import('./cli/commands/activate.js')
  const { teamCommand } = await import('./cli/commands/team.js')
  const { scheduleCommand } = await import('./cli/commands/schedule.js')
  const { agentsCommand } = await import('./cli/commands/agents.js')
  const { doctorCommand } = await import('./cli/commands/doctor.js')
  const { deployCommand } = await import('./cli/commands/deploy.js')

  commandRegistry.register(helpCommand)
  commandRegistry.register(planCommand)
  commandRegistry.register(yoloCommand)
  commandRegistry.register(reviewCommand)
  commandRegistry.register(brainCommand)
  commandRegistry.register(tasksCommand)
  commandRegistry.register(skillsCommand)
  commandRegistry.register(permissionsCommand)
  commandRegistry.register(statusCommand)

  commandRegistry.register(activateCommand)
  commandRegistry.register(teamCommand)
  commandRegistry.register(scheduleCommand)
  commandRegistry.register(agentsCommand)
  commandRegistry.register(doctorCommand)
  commandRegistry.register(deployCommand)

  const { startRepl } = await import('./repl.js')
  await startRepl(
    {
      engine, sessionStore, memoryStore, brainStore, scheduleStore,
      agentStore, jobResultStore, tokenCounter, contextManager,
      permissionGate, eventBus, hookRunner, teamManager, scheduler,
      bgTaskManager, commandRegistry, provider,
    },
    {
      resume: flags.resume as string | undefined,
      workingDir: process.cwd(),
      model: resolvedModel,
    },
  )
}

main().catch(err => {
  console.error(theme.error(err.message))
  process.exit(1)
})
