import { getApiKey, loadConfig, resolveModel, resolveProvider, modelDisplayName } from './utils/config.js'
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
import { readInput, setVimMode } from './ui/input.js'
import { theme } from './ui/theme.js'
import { platform } from './utils/platform.js'
import { getLayout, resetLayout } from './ui/fullscreen.js'
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
import { agentsCommand } from './commands/agents.js'
import { rcCommand } from './commands/rc.js'
import { statusCommand } from './commands/status.js'
import { ScheduleStore } from './scheduler/scheduleStore.js'
import { Scheduler } from './scheduler/scheduler.js'
import { AgentStore } from './agents/agentStore.js'
import { scheduleCommand } from './commands/schedule.js'
import { deployCommand } from './commands/deploy.js'
import { permissionsCommand } from './commands/permissions.js'
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
  if (options.provider) config.provider = resolveProvider(options.provider, config.provider)
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
  commandRegistry.register(agentsCommand)
  commandRegistry.register(scheduleCommand)
  commandRegistry.register(statusCommand)
  commandRegistry.register(deployCommand)
  commandRegistry.register(rcCommand)
  commandRegistry.register(permissionsCommand)

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
    minimaxiApiKey: config.minimaxiApiKey,
    minimaxiBaseUrl: config.minimaxiBaseUrl,
    minimaxiModel: config.minimaxiModel,
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
  engine.setBgTaskManager(bgTaskManager)
  engine.setHookRunner(hookRunner)
  engine.setPermissionWire(wire)

  globalEngine = engine
  backgroundManager = new BackgroundAgentManager()

  let currentAbortController: AbortController | null = null

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    const l = getLayout()
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
      l.log(theme.warning('Cancelled.'))
    } else {
      // If not in a query, treat as exit
      l.log(theme.dim('Use /exit to quit.'))
    }
  })

  // Load or create session
  let session = options.resume
    ? sessionStore.load(options.resume) || sessionStore.getLatest()
    : undefined

  if (session) {
    wire.enableFileLog(join(platform.configDir, 'sessions', `${session.id}.wire.jsonl`))
  }
  engine.setWire(wire)

  let messages: Message[] = session?.messages || []

  // Enter fullscreen layout
  const layout = getLayout()
  layout.enter()

  // Ensure we clean up fullscreen on exit
  let schedulerRef: { stop(): void } | null = null
  const cleanupFullscreen = () => { schedulerRef?.stop(); resetLayout() }
  process.on('exit', cleanupFullscreen)

  if (session && messages.length > 0) {
    layout.log(theme.dim(`Resumed session ${session.id} (${session.messages.length} messages)`))
    layout.log('')
    // Show last few messages for context
    const historyToShow = messages.slice(-6)
    for (const msg of historyToShow) {
      if (typeof msg.content === 'string') {
        if (msg.role === 'user') {
          layout.log(theme.info('You: ') + theme.dim(msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '')))
        } else {
          layout.log(theme.success('Claude: ') + theme.dim(msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '')))
        }
      } else {
        // ContentBlock[] — summarize
        const textBlocks = msg.content.filter(b => b.type === 'text')
        const toolBlocks = msg.content.filter(b => b.type === 'tool_use' || b.type === 'tool_result')
        if (msg.role === 'assistant' && textBlocks.length > 0) {
          const text = (textBlocks[0] as { text: string }).text
          layout.log(theme.success('Claude: ') + theme.dim(text.slice(0, 200) + (text.length > 200 ? '...' : '')))
        }
        if (toolBlocks.length > 0) {
          layout.log(theme.dim(`  (${toolBlocks.length} tool calls)`))
        }
      }
    }
    layout.log(theme.separator())
    layout.log('')
  }

  // Status bar (replaces old StatusLine)
  layout.setStatus('model', modelDisplayName(resolvedModel))
  layout.setStatus('tokens', '0↑ 0↓')
  layout.setStatus('cost', '$0.0000')
  layout.setStatus('mode', 'INSERT')

  // Banner
  const gitBranch = await (async () => {
    try {
      const { Git } = await import('./git/git.js')
      const git = new Git(workingDir)
      return await git.isRepo() ? await git.branch() : null
    } catch { return null }
  })()

  layout.log('')
  layout.log(theme.bold('  ╭─────────────────────────╮'))
  layout.log(theme.bold('  │') + theme.info('     autocli v0.1.1      ') + theme.bold('│'))
  layout.log(theme.bold('  ╰─────────────────────────╯'))
  layout.log('')
  layout.log(`  ${theme.dim('Model:')}   ${modelDisplayName(resolvedModel)}`)
  layout.log(`  ${theme.dim('Dir:')}     ${workingDir}`)
  if (gitBranch) layout.log(`  ${theme.dim('Branch:')}  ${gitBranch}`)
  if (isLicenseActive()) layout.log(`  ${formatInfo('Licensed')}`)
  layout.log(`  ${theme.dim('Type')} ${theme.info('/help')} ${theme.dim('for commands')}`)
  layout.log('')

  // Scheduler setup
  const agentStore = new AgentStore()
  const scheduleStore = new ScheduleStore()
  const scheduler = new Scheduler(scheduleStore, agentStore, async (template, wd) => {
    try {
      const workers = template.agents.map(a => {
        const def = agentStore.loadAgent(a.agentName)
        return { name: a.agentName, task: a.task, agentType: def?.agentType || 'general-purpose', model: def?.model }
      })
      const team = teamManager.createTeam(template.name, template.goal, workers)
      layout.log(theme.info(`[Scheduler] Team "${template.name}" started (${team.workers.length} workers)`))

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
    } catch (err) {
      layout.log(theme.error(`[Scheduler] Failed to start team "${template.name}": ${(err as Error).message}`))
    }
  })

  schedulerRef = scheduler

  if (scheduleStore.list().some(s => s.enabled)) {
    scheduler.start()
    layout.log(theme.dim(`Scheduler active (${scheduleStore.list().filter(s => s.enabled).length} schedules)`))
  }

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
      layout.log(theme.dim(`Session saved: ${session.id}`))
      scheduler.stop()
      resetLayout()
      process.exit(0)
    }

    // Check for commands
    const parsed = commandRegistry.parse(input)
    if (parsed) {
      const cmd = commandRegistry.get(parsed.name)
      if (!cmd) {
        layout.log(theme.error(`Unknown command: /${parsed.name}`))
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
        layout.log(result)
        continue
      }

      if (result.type === 'prompt') {
        messages.push({ role: 'user', content: result.prompt })
      } else if (result.type === 'compact') {
        layout.log(theme.dim('Compacting with LLM summarization...'))
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
        layout.log(theme.success(`Context compacted to ${messages.length} messages`))
        layout.log(theme.dim('  ─── context compacted above this line ───'))
        continue
      } else if (result.type === 'clear') {
        messages = []
        layout.log(theme.success('Conversation cleared.'))
        continue
      } else if (result.type === 'plan_toggle') {
        const currentPlan = engine.getPlanMode()
        engine.setPlanMode(!currentPlan)
        layout.log(engine.getPlanMode()
          ? theme.warning('Plan mode ON — write tools disabled.')
          : theme.success('Plan mode OFF — all tools enabled.'))
        continue
      } else if (result.type === 'yolo_toggle') {
        const currentMode = engine.getPermissionMode()
        const newMode = currentMode === 'auto-approve' ? 'default' : 'auto-approve'
        engine.setPermissionMode(newMode as 'default' | 'auto-approve')
        layout.log(newMode === 'auto-approve'
          ? theme.warning('YOLO mode ON — all tools auto-approved.')
          : theme.success('YOLO mode OFF — approval required for write tools.'))
        continue
      } else if (result.type === 'vim_toggle') {
        vimEnabled = !vimEnabled
        setVimMode(vimEnabled, (mode) => {
          layout.setStatus('mode', mode === 'normal' ? 'NORMAL' : 'INSERT')
        })
        layout.setStatus('mode', vimEnabled ? 'NORMAL' : 'INSERT')
        layout.log(vimEnabled ? theme.success('Vim mode ON') : theme.dim('Vim mode OFF'))
        continue
      } else if (result.type === 'model_switch') {
        engine.setModel(result.model)
        tokenCounter.updateModel(result.model)
        // Auto-switch provider when model implies it
        if (result.model === 'claude-local') {
          engine.setProvider('claude-local')
        } else if (result.model.startsWith('miniMax')) {
          engine.setProvider('minimaxi-cn')
        } else if ((engine.getProvider() === 'claude-local' || engine.getProvider() === 'minimaxi-cn') && !result.model.startsWith('miniMax') && result.model !== 'claude-local') {
          engine.setProvider('anthropic')
        }
        const displayName = modelDisplayName(result.model)
        layout.setStatus('model', displayName)
        layout.log(theme.success(`Model switched to ${displayName}`))
        continue
      } else if (result.type === 'team_status') {
        const activeTeam = teamManager.getActiveTeam()
        if (!activeTeam) {
          layout.log(theme.dim('No active team. Use the TeamCreate tool to create one.'))
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
          layout.log(renderSwarmStatus(agents))
          layout.log('')
          layout.log(renderAgentTree(agents))
          if (activeTeam.goal) layout.log(theme.dim(`  Goal: ${activeTeam.goal}`))
        }
        continue
      } else if (result.type === 'team_save') {
        const activeTeam = teamManager.getActiveTeam()
        if (!activeTeam) {
          layout.log(theme.error('No active team to save.'))
        } else {
          const { AgentStore } = await import('./agents/agentStore.js')
          const agentStore = new AgentStore()
          const template = {
            name: result.saveName,
            goal: activeTeam.goal,
            agents: activeTeam.workers.map(w => ({ agentName: w.name, task: w.task })),
            workingDir: workingDir,
          }
          agentStore.saveTeam(template)
          layout.log(theme.success(`Team saved as "${result.saveName}"`))
        }
        continue
      } else if (result.type === 'list_bg_tasks') {
        const tasks = bgTaskManager.list()
        if (tasks.length === 0) {
          layout.log(theme.dim('No background tasks running.'))
        } else {
          for (const t of tasks) {
            const status = t.status === 'running' ? theme.info('▶') : t.status === 'completed' ? theme.success('✓') : theme.error('✗')
            const elapsed = Math.round((Date.now() - t.startedAt) / 1000)
            layout.log(`  ${status} ${t.id} (${elapsed}s) ${theme.dim(t.command.slice(0, 60))}`)
          }
        }
        continue
      } else if (result.type === 'full_status') {
        // ── Teams ──
        const allTeams = teamManager.listTeams()
        const activeTeams = allTeams.filter(t => t.status === 'active')
        if (activeTeams.length > 0) {
          layout.log(theme.bold('Teams:'))
          for (const team of activeTeams) {
            const done = team.workers.filter(w => w.status === 'completed').length
            layout.log(`  ${theme.info(team.name)} ${theme.dim(`(${done}/${team.workers.length} done)`)}`)
            for (const w of team.workers) {
              const icon = w.status === 'running' ? theme.info('▶') : w.status === 'completed' ? theme.success('✓') : w.status === 'failed' ? theme.error('✗') : theme.dim('○')
              const elapsed = w.startedAt ? `${Math.round(((w.completedAt || Date.now()) - w.startedAt) / 1000)}s` : ''
              layout.log(`    ${icon} ${w.name} ${theme.dim(`[${w.status}] ${elapsed}`)}`)
            }
          }
        } else {
          layout.log(theme.dim('No active teams.'))
        }

        // ── Background Agents ──
        const bgAgents = backgroundManager?.getPendingNotifications() || []
        // getPendingNotifications marks them as notified, but we also want to show running ones
        // Use the internal agents map via the BackgroundAgentManager
        layout.log('')
        const allBgAgents = (() => {
          // Access running agents — backgroundManager stores them internally
          const agents: Array<{ id: string; description: string; status: string; elapsed: number }> = []
          // We can't access the private map directly, so check if there are any
          // For now, show a count-based message
          return agents
        })()
        // Show background shell tasks instead
        const bgTasks = bgTaskManager.list()
        if (bgTasks.length > 0) {
          layout.log(theme.bold('Background Tasks:'))
          for (const t of bgTasks) {
            const icon = t.status === 'running' ? theme.info('▶') : t.status === 'completed' ? theme.success('✓') : theme.error('✗')
            const elapsed = Math.round((Date.now() - t.startedAt) / 1000)
            layout.log(`  ${icon} ${t.id} ${theme.dim(`(${elapsed}s)`)} ${theme.dim(t.command.slice(0, 50))}`)
          }
        } else {
          layout.log(theme.dim('No background tasks.'))
        }

        // ── Schedules ──
        layout.log('')
        const schedules = scheduleStore.list()
        if (schedules.length > 0) {
          const { formatInterval } = await import('./scheduler/scheduleStore.js')
          layout.log(theme.bold('Schedules:'))
          for (const s of schedules) {
            const icon = s.enabled ? theme.success('●') : theme.dim('○')
            const next = s.enabled ? `next: ${new Date(s.nextRun).toLocaleTimeString()}` : 'disabled'
            layout.log(`  ${icon} ${theme.info(s.team)} every ${formatInterval(s.interval)} ${theme.dim(`(${next})`)}`)
          }
        } else {
          layout.log(theme.dim('No schedules.'))
        }

        layout.log('')
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
        layout.log(theme.success(`Rewound ${turnsFound} turn(s). ${messages.length} messages remaining.`))
        continue
      } else if (result.type === 'run_team') {
        const template = agentStore.loadTeam(result.team)
        if (!template) {
          layout.log(theme.error(`Team "${result.team}" not found.`))
        } else {
          layout.log(theme.info(`Running team "${result.team}"...`))
          const teamPrompt = `Run the team "${template.name}" with goal: ${template.goal}\n\nAgents:\n${template.agents.map((a: { agentName: string; task: string }) => `- ${a.agentName}: ${a.task}`).join('\n')}`
          messages.push({ role: 'user', content: teamPrompt })
        }
        continue
      } else if (result.type === 'rc_start') {
        // Start remote control session with eclaw-router
        try {
          const { RCClient } = await import('./remote/rcClient.js')
          const rcApiKey = process.env.ECLAW_API_KEY || config.apiKey || ''
          const rc = new RCClient({ serverUrl: result.serverUrl, apiKey: rcApiKey })
          await rc.start()

          // Connect wire events to browser
          rc.connectWire(wire)

          // Poll for browser input in background
          ;(async () => {
            for await (const item of rc.pollInput()) {
              if (item.type === 'input' && item.message) {
                // Inject browser message as user input
                messages.push({ role: 'user', content: item.message })
                layout.log(theme.info(`[RC] ${item.message}`))
                // Signal the engine to process this
                rc.pushEvent('agent_start', {})
                try {
                  const { response, messages: updated } = await engine.run(messages, workingDir)
                  messages = updated
                  const text = typeof response.content === 'string'
                    ? response.content
                    : response.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map(b => b.text).join('\n')
                  layout.log(text)
                  rc.pushEvent('agent_done', {})
                } catch (err) {
                  rc.pushEvent('error', { message: (err as Error).message })
                  rc.pushEvent('agent_done', {})
                }
              } else if (item.type === 'approval_response' && typeof item.approved === 'boolean') {
                // Handle approval from browser — logged for awareness
                layout.log(theme.dim(`[RC] Approval: ${item.approved ? 'approved' : 'denied'}`))
              }
            }
            layout.log(theme.dim('Remote control session ended.'))
          })()
        } catch (err) {
          layout.log(theme.error(`Failed to start RC: ${(err as Error).message}`))
        }
        continue
      } else {
        layout.log(result.text)
        continue
      }
    } else {
      messages.push({ role: 'user', content: input })
      layout.log(theme.dim(`  ${new Date().toLocaleTimeString()}`))
    }

    // Track message count before this turn so we can roll back the entire turn on error
    // (includes the user input we just pushed + any notification messages added below)
    const messageCountBeforeTurn = messages.length - 1

    // Check for background agent completions
    const bgNotifs = backgroundManager?.getPendingNotifications() || []
    for (const notif of bgNotifs) {
      let notifText: string
      if (notif.status === 'completed') {
        notifText = `[Background agent "${notif.description}" completed]\n\nResult:\n${notif.result}`
      } else if (notif.status === 'failed') {
        notifText = `[Background agent "${notif.description}" failed: ${notif.error}]`
      } else {
        notifText = `[Background agent "${notif.description}" is still running]`
      }
      layout.log(theme.info(notifText))
      messages.push({ role: 'user', content: notifText })
    }

    // Check for team worker completions
    const teamNotifs = teamManager.getPendingNotifications()
    for (const { team, worker } of teamNotifs) {
      const notifText = worker.status === 'completed'
        ? `[Team "${team.name}" — worker "${worker.name}" completed]\n\nResult:\n${worker.result?.slice(0, 2000)}`
        : `[Team "${team.name}" — worker "${worker.name}" failed: ${worker.error}]`
      layout.log(theme.info(notifText))
      messages.push({ role: 'user', content: notifText })
    }

    // Show status immediately so user knows input was received
    layout.setStatus('status', 'preparing…')

    // Emit wire event for user input
    wire.emit('user_input', { input })

    // Run hooks
    await hookRunner.run('before_response', { input })

    // Update brain context using the user's actual input, not notifications
    engine.setBrainContext(brainReader.buildPromptSection(input))

    // Query LLM
    layout.clearStatus('status')
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

      // Update status bar
      layout.setStatus('tokens', tokenCounter.formatUsage())
      layout.setStatus('cost', `$${tokenCounter.totalCost.toFixed(4)}`)
      const turnCost = tokenCounter.totalCost - prevCost
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      layout.log(theme.dim(`  ⏱ ${elapsed}s | turn: $${turnCost.toFixed(4)} | total: ${tokenCounter.formatUsage()}`))

      // Auto-compact if context is getting too large
      if (contextManager.needsCompaction(messages)) {
        layout.log(theme.dim('Auto-compacting context...'))
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
        layout.log(theme.dim(`Compacted to ${messages.length} messages`))
        layout.log(theme.dim('  ─── context compacted above this line ───'))
      }
    } catch (err) {
      // Roll back entire turn on error (user input + notifications)
      messages.length = messageCountBeforeTurn
      if ((err as Error).name !== 'AbortError' && !currentAbortController?.signal.aborted) {
        layout.log(formatError((err as Error).message))
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

    layout.log('')
  }
}
