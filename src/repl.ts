import { getApiKey, loadConfig, resolveModel } from './utils/config.js'
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
import { readInput, setVimMode } from './ui/input.js'
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
import { reviewCommand } from './commands/review.js'
import { initCommand } from './commands/init.js'
import { exportCommand } from './commands/export.js'
import { planCommand } from './commands/plan.js'
import { modelCommand } from './commands/model.js'
import { yoloCommand } from './commands/yolo.js'
import { contextCommand } from './commands/context.js'
import { doctorCommand } from './commands/doctor.js'
import { rewindCommand } from './commands/rewind.js'
import { copyCommand } from './commands/copy.js'
import { TeamManager } from './team/teamManager.js'
import { teamCommand } from './commands/team.js'
import type { Message, CommandResult } from './commands/types.js'
import type { HookEvent } from './hooks/types.js'
import { join } from 'path'
import { loadClaudeMdFiles } from './memory/claudeMd.js'
import { runMemoryExtraction } from './memory/autoExtract.js'
import { buildGitContext, buildProjectHint } from './git/gitContext.js'
import { Wire } from './wire/wire.js'
import { BackgroundTaskManager } from './tasks/backgroundTask.js'
import { tasksCommand } from './commands/tasks.js'
import { skillsCommand } from './commands/skills.js'
import { activateCommand } from './commands/activate.js'
import { vimCommand } from './commands/vim.js'
import { brainCommand } from './commands/brain.js'
import { searchCommand } from './commands/search.js'
import { BrainReader } from './brain/reader.js'
import { InputHistory } from './ui/history.js'
import { checkForUpdate, showUpdateNotice } from './utils/updater.js'
import { renderSwarmStatus, renderAgentTree, type AgentStatus } from './ui/swarmDisplay.js'
import { formatError, formatInfo } from './ui/errorFormat.js'
import { isLicenseActive } from './commands/activate.js'

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
  provider?: string
}): Promise<void> {
  const config = loadConfig()
  if (options.provider) config.provider = options.provider as 'anthropic' | 'openai' | 'claude-local'
  const apiKey = getApiKey()
  const workingDir = options.workingDir || process.cwd()

  const resolvedModel = options.model
    ? resolveModel(options.model, config.model)
    : config.model

  // Initialize subsystems
  const skillLoader = new SkillLoader([join(platform.configDir, 'skills')])
  const taskStore = new TaskStore(join(platform.configDir, 'tasks'))
  const teamManager = new TeamManager()
  const toolRegistry = new ToolRegistry()
  registerAllTools(toolRegistry, skillLoader, taskStore, teamManager)

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
  commandRegistry.register(reviewCommand)
  commandRegistry.register(initCommand)
  commandRegistry.register(exportCommand)
  commandRegistry.register(planCommand)
  commandRegistry.register(modelCommand)
  commandRegistry.register(yoloCommand)
  commandRegistry.register(tasksCommand)
  commandRegistry.register(skillsCommand)
  commandRegistry.register(activateCommand)
  commandRegistry.register(contextCommand)
  commandRegistry.register(doctorCommand)
  commandRegistry.register(rewindCommand)
  commandRegistry.register(copyCommand)
  commandRegistry.register(vimCommand)
  commandRegistry.register(teamCommand)
  commandRegistry.register(brainCommand)
  commandRegistry.register(searchCommand)

  const brainReader = new BrainReader(join(platform.configDir, 'brain'))

  const skillsList = skillLoader.list()
  const skillsPrompt = skillsList.length > 0
    ? '# Available Skills\n\nUse the Skill tool to invoke:\n' +
      skillsList.map(s => `- ${s.name}: ${s.description}`).join('\n')
    : ''

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
    memoryPrompt: memoryManager.loadForPrompt(),
    skillsPrompt,
    claudeMdPrompt: loadClaudeMdFiles(workingDir),
    gitContext,
    projectHint,
    maxSessionCost: config.maxSessionCost,
    provider: config.provider,
    openaiApiKey: config.openaiApiKey,
    openaiBaseUrl: config.openaiBaseUrl,
    // Always provide claudeLocalConfig so subagents can use claude-local even
    // when the main provider is different
    claudeLocalConfig: {
      command: config.claudeLocalCommand,
      args: config.claudeLocalArgs,
      claudeModel: config.claudeLocalModel,
      permissionMode: config.permissionMode,
    },
  })
  const wire = new Wire()
  const bgTaskManager = new BackgroundTaskManager()
  engine['config'].bgTaskManager = bgTaskManager
  engine['config'].hookRunner = hookRunner
  engine['permissionGate'].wire = wire

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

  if (session) {
    wire.enableFileLog(join(platform.configDir, 'sessions', `${session.id}.wire.jsonl`))
  }
  engine['config'].wire = wire

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
  statusLine.set('mode', 'INSERT')

  process.stdout.on('resize', () => {
    statusLine.hide()
    statusLine.show()
  })

  // Banner
  const gitBranch = await (async () => {
    try {
      const { Git } = await import('./git/git.js')
      const git = new Git(workingDir)
      return await git.isRepo() ? await git.branch() : null
    } catch { return null }
  })()

  console.log()
  console.log(theme.bold('  ╭─────────────────────────╮'))
  console.log(theme.bold('  │') + theme.info('     autocli v0.1.0  ') + theme.bold('│'))
  console.log(theme.bold('  ╰─────────────────────────╯'))
  console.log()
  console.log(`  ${theme.dim('Model:')}   ${resolvedModel.split('-').slice(0, 2).join(' ')}`)
  console.log(`  ${theme.dim('Dir:')}     ${workingDir}`)
  if (gitBranch) console.log(`  ${theme.dim('Branch:')}  ${gitBranch}`)
  if (isLicenseActive()) console.log(`  ${formatInfo('Licensed')}`)
  console.log(`  ${theme.dim('Type')} ${theme.info('/help')} ${theme.dim('for commands')}`)
  console.log()

  // Check for updates (non-blocking)
  checkForUpdate().then(v => {
    if (v) showUpdateNotice(v)
  }).catch(() => {})

  // Input history
  const inputHistory = new InputHistory(join(platform.configDir, 'history'))

  let vimEnabled = false
  const cmdNames = commandRegistry.list().map(c => c.name)

  // REPL loop
  let turnCount = 0
  while (true) {
    const input = await readInput(theme.info('> '), inputHistory.getEntries(), cmdNames)
    inputHistory.add(input)

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
        console.log(theme.dim('Compacting with LLM summarization...'))
        messages = await contextManager.compactWithLLM(messages, async (prompt) => {
          const { response } = await engine.run(
            [{ role: 'user', content: prompt }],
            workingDir,
          )
          if (typeof response.content === 'string') return response.content
          return response.content
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map(b => b.text).join('\n')
        })
        console.log(theme.success(`Context compacted to ${messages.length} messages`))
        console.log(theme.dim('  ─── context compacted above this line ───'))
        continue
      } else if (result.type === 'clear') {
        messages = []
        console.log(theme.success('Conversation cleared.'))
        continue
      } else if (result.type === 'plan_toggle') {
        const currentPlan = engine['config'].planMode || false
        engine['config'].planMode = !currentPlan
        console.log(engine['config'].planMode
          ? theme.warning('Plan mode ON — write tools disabled.')
          : theme.success('Plan mode OFF — all tools enabled.'))
        continue
      } else if (result.type === 'yolo_toggle') {
        const currentMode = engine['config'].permissionConfig?.mode
        const newMode = currentMode === 'auto-approve' ? 'default' : 'auto-approve'
        if (engine['config'].permissionConfig) {
          engine['config'].permissionConfig.mode = newMode
        }
        engine['permissionGate']['config'].mode = newMode
        console.log(newMode === 'auto-approve'
          ? theme.warning('YOLO mode ON — all tools auto-approved.')
          : theme.success('YOLO mode OFF — approval required for write tools.'))
        continue
      } else if (result.type === 'vim_toggle') {
        vimEnabled = !vimEnabled
        setVimMode(vimEnabled, (mode) => {
          statusLine.set('mode', mode === 'normal' ? 'NORMAL' : 'INSERT')
        })
        statusLine.set('mode', vimEnabled ? 'NORMAL' : 'INSERT')
        console.log(vimEnabled ? theme.success('Vim mode ON') : theme.dim('Vim mode OFF'))
        continue
      } else if (result.type === 'model_switch') {
        engine['config'].model = result.model
        tokenCounter.updateModel(result.model)
        // Auto-switch provider when model implies it
        if (result.model === 'claude-local') {
          engine['config'].provider = 'claude-local'
        } else if (engine['config'].provider === 'claude-local' && result.model !== 'claude-local') {
          engine['config'].provider = 'anthropic'
        }
        const displayName = result.model === 'claude-local' ? 'claude (local)' : result.model.split('-').slice(0, 2).join(' ')
        statusLine.set('model', displayName)
        console.log(theme.success(`Model switched to ${displayName}`))
        continue
      } else if (result.type === 'team_status') {
        const activeTeam = teamManager.getActiveTeam()
        if (!activeTeam) {
          console.log(theme.dim('No active team. Use the TeamCreate tool to create one.'))
        } else {
          const agents: AgentStatus[] = activeTeam.workers.map(w => ({
            id: w.id,
            name: w.name,
            type: w.agentType,
            status: w.status === 'pending' ? 'idle' as const : w.status as 'running' | 'completed' | 'failed',
            toolCount: 0,
            tokenCount: 0,
            elapsed: w.startedAt ? Math.round(((w.completedAt || Date.now()) - w.startedAt) / 1000) : 0,
          }))
          console.log(renderSwarmStatus(agents))
          console.log()
          console.log(renderAgentTree(agents))
          if (activeTeam.goal) console.log(theme.dim(`  Goal: ${activeTeam.goal}`))
        }
        continue
      } else if (result.type === 'list_bg_tasks') {
        const tasks = bgTaskManager.list()
        if (tasks.length === 0) {
          console.log(theme.dim('No background tasks running.'))
        } else {
          for (const t of tasks) {
            const status = t.status === 'running' ? theme.info('▶') : t.status === 'completed' ? theme.success('✓') : theme.error('✗')
            const elapsed = Math.round((Date.now() - t.startedAt) / 1000)
            console.log(`  ${status} ${t.id} (${elapsed}s) ${theme.dim(t.command.slice(0, 60))}`)
          }
        }
        continue
      } else if (result.type === 'rewind') {
        // Count back N user messages (turns), removing all messages from that point
        let turnsFound = 0
        let cutIdx = messages.length
        for (let i = messages.length - 1; i >= 0 && turnsFound < result.turns; i--) {
          if (messages[i].role === 'user' && typeof messages[i].content === 'string') {
            turnsFound++
            cutIdx = i
          }
        }
        messages = messages.slice(0, cutIdx)
        console.log(theme.success(`Rewound ${turnsFound} turn(s). ${messages.length} messages remaining.`))
        continue
      } else {
        console.log(result.text)
        continue
      }
    } else {
      messages.push({ role: 'user', content: input })
      console.log(theme.dim(`  ${new Date().toLocaleTimeString()}`))
    }

    // Track message count before this turn so we can roll back on error
    const messageCountBeforeTurn = messages.length - 1 // -1 for the user input we just pushed

    // Check for background agent completions
    const bgNotifs = backgroundManager?.getPendingNotifications() || []
    for (const notif of bgNotifs) {
      const notifText = notif.status === 'completed'
        ? `[Background agent "${notif.description}" completed]\n\nResult:\n${notif.result}`
        : `[Background agent "${notif.description}" failed: ${notif.error}]`
      console.log(theme.info(notifText))
      messages.push({ role: 'user', content: notifText })
    }

    // Check for team worker completions
    const teamNotifs = teamManager.getPendingNotifications()
    for (const { team, worker } of teamNotifs) {
      const notifText = worker.status === 'completed'
        ? `[Team "${team.name}" — worker "${worker.name}" completed]\n\nResult:\n${worker.result?.slice(0, 2000)}`
        : `[Team "${team.name}" — worker "${worker.name}" failed: ${worker.error}]`
      console.log(theme.info(notifText))
      messages.push({ role: 'user', content: notifText })
    }

    // Emit wire event for user input
    wire.emit('user_input', { input })

    // Run hooks
    await hookRunner.run('before_response', { input })

    // Update brain context using the user's actual input, not notifications
    engine['config'].brainContext = brainReader.buildPromptSection(input)

    // Query LLM
    const startTime = Date.now()
    const prevCost = tokenCounter.totalCost
    currentAbortController = new AbortController()
    try {
      const result = await engine.run(messages, workingDir, currentAbortController.signal)
      messages = result.messages

      // Auto-title session from first user message
      if (session && !session.title && messages.length >= 2) {
        const firstMsg = messages.find(m => m.role === 'user' && typeof m.content === 'string')
        if (firstMsg && typeof firstMsg.content === 'string') {
          session.title = firstMsg.content.slice(0, 60) + (firstMsg.content.length > 60 ? '...' : '')
        }
      }

      // Update status
      statusLine.set('tokens', tokenCounter.formatUsage())
      const turnCost = tokenCounter.totalCost - prevCost
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(theme.dim(`  ⏱ ${elapsed}s | turn: $${turnCost.toFixed(4)} | total: ${tokenCounter.formatUsage()}`))

      // Auto-compact if context is getting too large
      if (contextManager.needsCompaction(messages)) {
        console.log(theme.dim('Auto-compacting context...'))
        messages = await contextManager.compactWithLLM(messages, async (prompt) => {
          const { response: compactResp } = await engine.run(
            [{ role: 'user', content: prompt }],
            workingDir,
          )
          if (typeof compactResp.content === 'string') return compactResp.content
          return compactResp.content
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map(b => b.text).join('\n')
        }).catch(() => contextManager.fitToContext(messages))
        console.log(theme.dim(`Compacted to ${messages.length} messages`))
        console.log(theme.dim('  ─── context compacted above this line ───'))
      }
    } catch (err) {
      // Remove all messages we added this turn (user input + notifications)
      messages.length = messageCountBeforeTurn
      if ((err as Error).name !== 'AbortError' && !currentAbortController?.signal.aborted) {
        console.log(formatError((err as Error).message))
        hookRunner.run('on_error', { error: (err as Error).message }).catch(() => {})
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
      }, apiKey, 'claude-haiku-3-5-20241022').catch(() => {}) // Silent failure — always use haiku for cost
    }

    console.log()
  }
}
