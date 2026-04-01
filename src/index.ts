#!/usr/bin/env bun

import { startRepl } from './repl.js'
import { startHeadless } from './remote/headless.js'
import { theme } from './ui/theme.js'

const args = process.argv.slice(2)

function parseArgs() {
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') { flags.help = true }
    else if (arg === '--version' || arg === '-v') { flags.version = true }
    else if (arg === '--resume' || arg === '-r') { flags.resume = args[++i] || 'latest' }
    else if (arg === '--headless') { flags.headless = true }
    else if (arg === '--port' || arg === '-p') { flags.port = args[++i] }
    else if (arg === '--prompt') { flags.prompt = args[++i] }
    else if (arg === '--model' || arg === '-m') { flags.model = args[++i] }
    else if (arg === '--set-key') { flags.setKey = args[++i] }
    else if (arg === '--provider') { flags.provider = args[++i] }
    else if (arg === '--scheduler') { flags.scheduler = true }
    else if (arg === '--run-team') { flags.runTeam = args[++i] }
    else if (!arg.startsWith('-')) { flags.prompt = arg }
  }
  return flags
}

async function main() {
  const flags = parseArgs()

  if (flags.version) {
    console.log('autocli v0.1.1')
    process.exit(0)
  }

  if (flags.help) {
    console.log(`
${theme.bold('autocli')} — A minimal AI coding assistant

${theme.bold('Usage:')}
  autocli                    Start interactive REPL
  autocli "prompt"           One-shot query
  autocli --resume [id]      Resume a session
  autocli --headless         Start as remote daemon

${theme.bold('Options:')}
  -h, --help                    Show this help
  -v, --version                 Show version
  -r, --resume [id]             Resume session (latest if no id)
  -p, --port <port>             Port for headless mode (default: 3456)
  -m, --model <model>           Model to use (sonnet, opus, haiku, local, minimax)
  --provider <name>             Provider (anthropic, openai, claude-local, minimaxi-cn)
  --headless                    Run as headless daemon
  --set-key <key>               Save API key
  --scheduler                    Run as scheduler daemon
  --run-team <name>              Run a team template once (for cron)
`)
    process.exit(0)
  }

  if (flags.setKey) {
    const { saveConfig, loadConfig } = await import('./utils/config.js')
    const config = loadConfig()
    config.apiKey = flags.setKey as string
    saveConfig(config)
    console.log(theme.success('API key saved.'))
    process.exit(0)
  }

  if (flags.scheduler) {
    const { AgentStore } = await import('./agents/agentStore.js')
    const { ScheduleStore } = await import('./scheduler/scheduleStore.js')
    const { Scheduler } = await import('./scheduler/scheduler.js')
    const agentStore = new AgentStore()
    const scheduleStore = new ScheduleStore()
    const active = scheduleStore.list().filter(s => s.enabled)
    if (active.length === 0) {
      console.log(theme.warning('No enabled schedules found.'))
      process.exit(0)
    }
    const scheduler = new Scheduler(scheduleStore, agentStore, async () => {})
    scheduler.start()
    console.log(theme.info(`Scheduler daemon started with ${active.length} schedule(s). Press Ctrl+C to stop.`))
    await new Promise(() => {}) // block forever
    return
  }

  if (flags.runTeam) {
    const { AgentStore } = await import('./agents/agentStore.js')
    const agentStore = new AgentStore()
    const template = agentStore.loadTeam(flags.runTeam as string)
    if (!template) {
      console.error(theme.error(`Team "${flags.runTeam}" not found.`))
      process.exit(1)
    }
    console.log(theme.info(`Running team "${template.name}"...`))
    // For now, just report — full execution requires engine setup
    console.log(theme.dim(`Goal: ${template.goal}`))
    console.log(theme.dim(`Agents: ${template.agents.map(a => a.agentName).join(', ')}`))
    process.exit(0)
  }

  if (flags.headless) {
    const port = Number(flags.port) || 3456
    await startHeadless(port)
    return
  }

  // Read piped stdin
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

  if (flags.prompt) {
    await runOneShot(flags.prompt as string, process.cwd(), flags.model as string | undefined, flags.provider as string | undefined)
    return
  }

  await startRepl({
    resume: flags.resume as string | undefined,
    workingDir: process.cwd(),
    model: flags.model as string | undefined,
    provider: flags.provider as string | undefined,
  })
}

async function runOneShot(prompt: string, workingDir: string, modelFlag?: string, providerFlag?: string): Promise<void> {
  const { loadConfig, getApiKey, resolveModel } = await import('./utils/config.js')
  const { ToolRegistry } = await import('./tools/registry.js')
  const { TokenCounter } = await import('./engine/tokenCounter.js')
  const { ContextManager } = await import('./engine/contextManager.js')
  const { QueryEngine } = await import('./engine/queryEngine.js')
  const { registerAllTools } = await import('./tools/registerAll.js')
  const { setGlobalEngine } = await import('./repl.js')
  const { buildGitContext, buildProjectHint } = await import('./git/gitContext.js')

  const config = loadConfig()
  const provider = (providerFlag || config.provider) as 'anthropic' | 'openai' | 'claude-local'
  if (providerFlag) config.provider = provider
  const apiKey = getApiKey()

  const resolvedModel = modelFlag
    ? resolveModel(modelFlag, config.model)
    : config.model

  const toolRegistry = new ToolRegistry()
  registerAllTools(toolRegistry)

  const tokenCounter = new TokenCounter(resolvedModel)
  const contextManager = new ContextManager()

  const gitContext = await buildGitContext(workingDir)
  const projectHint = await buildProjectHint(workingDir)

  const engine = new QueryEngine({
    apiKey,
    model: resolvedModel,
    toolRegistry,
    tokenCounter,
    contextManager,
    permissionConfig: {
      mode: config.permissionMode,
      rules: [],
      alwaysAllow: new Set(),
    },
    gitContext,
    projectHint,
    provider,
    openaiApiKey: config.openaiApiKey,
    openaiBaseUrl: config.openaiBaseUrl,
    claudeLocalConfig: provider === 'claude-local' ? {
      command: config.claudeLocalCommand,
      args: config.claudeLocalArgs,
      claudeModel: config.claudeLocalModel,
    } : undefined,
  })
  setGlobalEngine(engine)

  const messages = [{ role: 'user' as const, content: prompt }]

  try {
    await engine.run(messages, workingDir)
  } catch (err) {
    console.error(theme.error((err as Error).message))
    process.exit(1)
  }

  // Print cost summary
  console.log()
  console.log(theme.dim(tokenCounter.formatUsage()))
}

main().catch(err => {
  console.error(theme.error(err.message))
  process.exit(1)
})
