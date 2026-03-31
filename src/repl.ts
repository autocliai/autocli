import { getApiKey, loadConfig } from './utils/config.js'
import { ToolRegistry } from './tools/registry.js'
import { TokenCounter } from './engine/tokenCounter.js'
import { ContextManager } from './engine/contextManager.js'
import { QueryEngine } from './engine/queryEngine.js'
import { CommandRegistry } from './commands/registry.js'
import { SessionStore } from './session/sessionStore.js'
import { MemoryManager } from './memory/memoryManager.js'
import { SkillLoader } from './skills/loader.js'
import { HookRunner } from './hooks/hookRunner.js'
import { StatusLine } from './ui/statusLine.js'
import { readInput } from './ui/input.js'
import { theme } from './ui/theme.js'
import { platform } from './utils/platform.js'
import { registerAllTools } from './tools/registerAll.js'
import { helpCommand } from './commands/help.js'
import { costCommand } from './commands/cost.js'
import { diffCommand } from './commands/diff.js'
import { commitCommand } from './commands/commit.js'
import { compactCommand } from './commands/compact.js'
import type { Message } from './commands/types.js'
import type { HookEvent } from './hooks/types.js'
import { join } from 'path'

let globalEngine: QueryEngine | null = null
export function getGlobalEngine(): QueryEngine | null {
  return globalEngine
}

export async function startRepl(options: {
  resume?: string
  workingDir?: string
}): Promise<void> {
  const config = loadConfig()
  const apiKey = getApiKey()
  const workingDir = options.workingDir || process.cwd()

  // Initialize subsystems
  const toolRegistry = new ToolRegistry()
  registerAllTools(toolRegistry)

  const tokenCounter = new TokenCounter(config.model)
  const contextManager = new ContextManager()
  const sessionStore = new SessionStore(join(platform.configDir, 'sessions'))
  const memoryManager = new MemoryManager(join(platform.configDir, 'memory'))
  const skillLoader = new SkillLoader([join(platform.configDir, 'skills')])
  const hookRunner = new HookRunner(config.hooks.map(h => ({
    event: h.event as HookEvent,
    command: h.command,
    pattern: h.pattern,
  })))

  const commandRegistry = new CommandRegistry()
  commandRegistry.register(helpCommand)
  commandRegistry.register(costCommand)
  commandRegistry.register(diffCommand)
  commandRegistry.register(commitCommand)
  commandRegistry.register(compactCommand)

  const engine = new QueryEngine({
    apiKey,
    model: config.model,
    toolRegistry,
    tokenCounter,
    contextManager,
    permissionConfig: {
      mode: config.permissionMode,
      rules: [],
      alwaysAllow: new Set(),
    },
  })
  globalEngine = engine

  // Load or create session
  let session = options.resume
    ? sessionStore.load(options.resume) || sessionStore.getLatest()
    : undefined

  let messages: Message[] = session?.messages || []

  if (session) {
    console.log(theme.dim(`Resumed session ${session.id} (${session.messages.length} messages)`))
  }

  // Status line
  const statusLine = new StatusLine()
  statusLine.set('model', config.model.split('-').slice(0, 2).join(' '))
  statusLine.set('tokens', '0↑ 0↓')
  statusLine.set('cost', '$0.0000')

  // Banner
  console.log()
  console.log(theme.bold('Mini Claude') + theme.dim(' v0.1.0'))
  console.log(theme.dim(`Working directory: ${workingDir}`))
  console.log(theme.dim('Type /help for commands, or start chatting.'))
  console.log()

  // REPL loop
  while (true) {
    const input = await readInput(theme.info('> '))

    if (!input.trim()) continue
    if (input.trim() === '/exit' || input.trim() === '/quit') {
      // Save session
      if (!session) session = sessionStore.create(workingDir)
      session.messages = messages
      session.totalCost = tokenCounter.totalCost
      session.totalTokens = { input: tokenCounter.totalInput, output: tokenCounter.totalOutput }
      sessionStore.save(session)
      console.log(theme.dim(`Session saved: ${session.id}`))
      break
    }

    // Check for commands
    const parsed = commandRegistry.parse(input)
    if (parsed) {
      const cmd = commandRegistry.get(parsed.name)
      if (!cmd) {
        console.log(theme.error(`Unknown command: /${parsed.name}`))
        continue
      }

      const result = await cmd.run(parsed.args, {
        workingDir,
        sessionId: session?.id || '',
        messages,
        totalCost: tokenCounter.totalCost,
        totalTokens: { input: tokenCounter.totalInput, output: tokenCounter.totalOutput },
      })

      // Handle special command responses
      if (result.startsWith('__PROMPT__:')) {
        const prompt = result.slice('__PROMPT__:'.length)
        messages.push({ role: 'user', content: prompt })
      } else if (result.startsWith('__COMPACT__:')) {
        messages = contextManager.fitToContext(messages)
        console.log(theme.success(`Context compacted to ${messages.length} messages`))
        continue
      } else {
        console.log(result)
        continue
      }
    } else {
      messages.push({ role: 'user', content: input })
    }

    // Run hooks
    await hookRunner.run('before_response', { input })

    // Query LLM
    try {
      const result = await engine.run(messages, workingDir)
      messages = result.messages

      // Update status
      statusLine.set('tokens', tokenCounter.formatUsage())
    } catch (err) {
      console.log(theme.error(`Error: ${(err as Error).message}`))
    }

    // Run hooks
    await hookRunner.run('after_response', {})

    // Auto-save session periodically
    if (!session) session = sessionStore.create(workingDir)
    session.messages = messages
    session.totalCost = tokenCounter.totalCost
    session.totalTokens = { input: tokenCounter.totalInput, output: tokenCounter.totalOutput }
    sessionStore.save(session)

    console.log()
  }
}
