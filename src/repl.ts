import { getApiKey, loadConfig } from './utils/config.js'
import { ToolRegistry } from './tools/registry.js'
import { TokenCounter } from './engine/tokenCounter.js'
import { ContextManager } from './engine/contextManager.js'
import { QueryEngine, BackgroundAgentManager } from './engine/queryEngine.js'
import { CommandRegistry } from './commands/registry.js'
import { SessionStore } from './session/sessionStore.js'
import { MemoryManager } from './memory/memoryManager.js'
import { SkillLoader } from './skills/loader.js'
import { TaskStore } from './tasks/taskStore.js'
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
import { clearCommand } from './commands/clear.js'
import { sessionsCommand } from './commands/sessions.js'
import type { Message, CommandResult } from './commands/types.js'
import type { HookEvent } from './hooks/types.js'
import { join } from 'path'
import { loadClaudeMdFiles } from './memory/claudeMd.js'
import { runMemoryExtraction } from './memory/autoExtract.js'
import { buildGitContext } from './git/gitContext.js'

let globalEngine: QueryEngine | null = null
export function getGlobalEngine(): QueryEngine | null {
  return globalEngine
}
export function setGlobalEngine(engine: QueryEngine): void {
  globalEngine = engine
}

let backgroundManager: BackgroundAgentManager | null = null
export function getBackgroundManager(): BackgroundAgentManager | null {
  return backgroundManager
}

export async function startRepl(options: {
  resume?: string
  workingDir?: string
  model?: string
}): Promise<void> {
  const config = loadConfig()
  const apiKey = getApiKey()
  const workingDir = options.workingDir || process.cwd()

  const MODEL_MAP: Record<string, string> = {
    'sonnet': 'claude-sonnet-4-20250514',
    'opus': 'claude-opus-4-20250514',
    'haiku': 'claude-haiku-3-5-20241022',
  }
  const resolvedModel = options.model
    ? MODEL_MAP[options.model] || options.model
    : config.model

  // Initialize subsystems
  const skillLoader = new SkillLoader([join(platform.configDir, 'skills')])
  const taskStore = new TaskStore(join(platform.configDir, 'tasks'))
  const toolRegistry = new ToolRegistry()
  registerAllTools(toolRegistry, skillLoader, taskStore)

  const tokenCounter = new TokenCounter(resolvedModel)
  const contextManager = new ContextManager()
  const sessionStore = new SessionStore(join(platform.configDir, 'sessions'))
  const memoryManager = new MemoryManager(join(platform.configDir, 'memory'))
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
  commandRegistry.register(clearCommand)
  commandRegistry.register(sessionsCommand)

  const skillsList = skillLoader.list()
  const skillsPrompt = skillsList.length > 0
    ? '# Available Skills\n\nUse the Skill tool to invoke:\n' +
      skillsList.map(s => `- ${s.name}: ${s.description}`).join('\n')
    : ''

  const gitContext = await buildGitContext(workingDir)

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
    memoryPrompt: memoryManager.loadForPrompt(),
    skillsPrompt,
    claudeMdPrompt: loadClaudeMdFiles(workingDir),
    gitContext,
  })
  globalEngine = engine
  backgroundManager = new BackgroundAgentManager()

  let currentAbortController: AbortController | null = null

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
      console.log(theme.warning('\nCancelled.'))
    } else {
      // If not in a query, treat as exit
      console.log(theme.dim('\nUse /exit to quit.'))
    }
  })

  // Load or create session
  let session = options.resume
    ? sessionStore.load(options.resume) || sessionStore.getLatest()
    : undefined

  let messages: Message[] = session?.messages || []

  if (session && messages.length > 0) {
    console.log(theme.dim(`Resumed session ${session.id} (${session.messages.length} messages)`))
    console.log()
    // Show last few messages for context
    const historyToShow = messages.slice(-6)
    for (const msg of historyToShow) {
      if (typeof msg.content === 'string') {
        if (msg.role === 'user') {
          console.log(theme.info('You: ') + theme.dim(msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '')))
        } else {
          console.log(theme.success('Claude: ') + theme.dim(msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '')))
        }
      } else {
        // ContentBlock[] — summarize
        const textBlocks = msg.content.filter(b => b.type === 'text')
        const toolBlocks = msg.content.filter(b => b.type === 'tool_use' || b.type === 'tool_result')
        if (msg.role === 'assistant' && textBlocks.length > 0) {
          const text = (textBlocks[0] as { text: string }).text
          console.log(theme.success('Claude: ') + theme.dim(text.slice(0, 200) + (text.length > 200 ? '...' : '')))
        }
        if (toolBlocks.length > 0) {
          console.log(theme.dim(`  (${toolBlocks.length} tool calls)`))
        }
      }
    }
    console.log(theme.separator())
    console.log()
  }

  // Status line
  const statusLine = new StatusLine()
  statusLine.set('model', resolvedModel.split('-').slice(0, 2).join(' '))
  statusLine.set('tokens', '0↑ 0↓')
  statusLine.set('cost', '$0.0000')

  // Banner
  console.log()
  console.log(theme.bold('Mini Claude') + theme.dim(' v0.1.0'))
  console.log(theme.dim(`Working directory: ${workingDir}`))
  console.log(theme.dim('Type /help for commands, or start chatting.'))
  console.log()

  // REPL loop
  let turnCount = 0
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

      // Handle typed or string command results
      if (typeof result === 'string') {
        console.log(result)
        continue
      }

      if (result.type === 'prompt') {
        messages.push({ role: 'user', content: result.prompt })
      } else if (result.type === 'compact') {
        messages = contextManager.fitToContext(messages)
        console.log(theme.success(`Context compacted to ${messages.length} messages`))
        continue
      } else if (result.type === 'clear') {
        messages = []
        console.log(theme.success('Conversation cleared.'))
        continue
      } else {
        console.log(result.text)
        continue
      }
    } else {
      messages.push({ role: 'user', content: input })
    }

    // Check for background agent completions
    const bgNotifs = backgroundManager?.getPendingNotifications() || []
    for (const notif of bgNotifs) {
      const notifText = notif.status === 'completed'
        ? `[Background agent "${notif.description}" completed]\n\nResult:\n${notif.result}`
        : `[Background agent "${notif.description}" failed: ${notif.error}]`
      console.log(theme.info(notifText))
      messages.push({ role: 'user', content: notifText })
    }

    // Run hooks
    await hookRunner.run('before_response', { input })

    // Query LLM
    currentAbortController = new AbortController()
    try {
      const result = await engine.run(messages, workingDir, currentAbortController.signal)
      messages = result.messages

      // Update status
      statusLine.set('tokens', tokenCounter.formatUsage())
    } catch (err) {
      if ((err as Error).name === 'AbortError' || currentAbortController?.signal.aborted) {
        // User cancelled — remove the pending user message
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
          messages.pop()
        }
      } else {
        // Remove the user message we just pushed since the call failed
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
          messages.pop()
        }
        console.log(theme.error(`Error: ${(err as Error).message}`))
      }
    }
    currentAbortController = null

    // Run hooks
    await hookRunner.run('after_response', {})

    // Auto-save session periodically
    if (!session) session = sessionStore.create(workingDir)
    session.messages = messages
    session.totalCost = tokenCounter.totalCost
    session.totalTokens = { input: tokenCounter.totalInput, output: tokenCounter.totalOutput }
    sessionStore.save(session)

    // Auto-extract memories every 5 turns
    turnCount++
    if (turnCount % 5 === 0 && messages.length > 0) {
      runMemoryExtraction(messages, memoryManager, async (prompt) => {
        const { response } = await engine.run(
          [{ role: 'user', content: prompt }],
          workingDir,
        )
        if (typeof response.content === 'string') return response.content
        return response.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map(b => b.text).join('\n')
      }).catch(() => {}) // Silent failure
    }

    console.log()
  }
}
