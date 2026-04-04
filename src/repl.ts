import type { QueryEngine } from './services/engine/queryEngine.js'
import type { Message } from './services/providers/types.js'
import type { CommandRegistry } from './cli/commands/registry.js'
import type { SessionStore, Session } from './stores/sessionStore.js'
import type { MemoryStore } from './stores/memoryStore.js'
import type { BrainStore } from './stores/brainStore.js'
import type { ScheduleStore } from './stores/scheduleStore.js'
import type { AgentStore } from './stores/agentStore.js'
import type { JobResultStore } from './stores/jobResultStore.js'
import type { TokenCounter } from './services/engine/tokenCounter.js'
import type { ContextManager } from './services/engine/contextManager.js'
import type { PermissionGate } from './services/permissions/permissionGate.js'
import type { EventBus } from './services/events/eventBus.js'
import type { HookRunner } from './services/hooks/hookRunner.js'
import type { TeamManager } from './services/teams/teamManager.js'
import type { Scheduler } from './services/scheduler/scheduler.js'
import type { BackgroundTaskManager } from './services/engine/backgroundTask.js'
import type { LLMProvider } from './services/providers/types.js'

import { readInput, readSingleLine } from './cli/ui/input.js'
import { theme } from './cli/ui/theme.js'
import { formatError } from './cli/ui/errorFormat.js'
import { modelDisplayName } from './utils/config.js'

import { extractMemories } from './services/engine/autoExtract.js'
import { checkForUpdate, showUpdateNotice } from './utils/updater.js'
import { InputHistory } from './cli/ui/history.js'
import { platform } from './utils/platform.js'
import { Git } from './services/git/git.js'
import { join } from 'path'

const VERSION = '0.2.3'

export interface ReplDeps {
  engine: QueryEngine
  sessionStore: SessionStore
  memoryStore: MemoryStore
  brainStore: BrainStore
  scheduleStore: ScheduleStore
  agentStore: AgentStore
  jobResultStore: JobResultStore
  tokenCounter: TokenCounter
  contextManager: ContextManager
  permissionGate: PermissionGate
  eventBus: EventBus
  hookRunner: HookRunner
  teamManager: TeamManager
  scheduler: Scheduler
  bgTaskManager: BackgroundTaskManager
  commandRegistry: CommandRegistry
  provider: LLMProvider
}

export interface ReplOptions {
  resume?: string
  workingDir: string
  model: string
}

let globalEngine: QueryEngine | null = null
export function getGlobalEngine(): QueryEngine | null { return globalEngine }
export function setGlobalEngine(engine: QueryEngine): void { globalEngine = engine }

export async function startRepl(deps: ReplDeps, options: ReplOptions): Promise<void> {
  const {
    engine, sessionStore, memoryStore, brainStore, scheduleStore,
    agentStore, jobResultStore, tokenCounter, contextManager,
    permissionGate, eventBus, hookRunner, teamManager, scheduler,
    bgTaskManager, commandRegistry, provider,
  } = deps
  const workingDir = options.workingDir

  globalEngine = engine

  // Load or create session
  let session: Session | undefined
  if (options.resume) {
    if (options.resume === 'latest') {
      session = sessionStore.getLatest() || undefined
    } else {
      session = sessionStore.load(options.resume) || undefined
      if (!session) {
        console.error(theme.warning(`Session "${options.resume}" not found. Starting new session.`))
      }
    }
  }

  let messages: Message[] = session?.messages || []

  // Ensure cleanup on exit
  const cleanup = () => { scheduler.stop() }
  process.on('exit', cleanup)

  // Handle Ctrl+C gracefully
  let currentAbortController: AbortController | null = null
  process.on('SIGINT', () => {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
      console.log(theme.warning('\nCancelled.'))
    } else {
      console.log(theme.dim('\nUse /exit to quit.'))
    }
  })

  // Show resumed session context
  if (session && messages.length > 0) {
    console.log(theme.dim(`Resumed session ${session.id} (${session.messages.length} messages)`))
    const historyToShow = messages.slice(-6)
    for (const msg of historyToShow) {
      const textBlocks = msg.content.filter(b => b.type === 'text')
      const toolBlocks = msg.content.filter(b => b.type === 'tool_use' || b.type === 'tool_result')
      if (msg.role === 'user' && textBlocks.length > 0) {
        const text = textBlocks[0].text || ''
        console.log(theme.info('▸ ') + theme.dim(text.slice(0, 200) + (text.length > 200 ? '...' : '')))
      } else if (msg.role === 'assistant' && textBlocks.length > 0) {
        const text = textBlocks[0].text || ''
        console.log(theme.success('◂ ') + theme.dim(text.slice(0, 200) + (text.length > 200 ? '...' : '')))
      }
      if (toolBlocks.length > 0) {
        console.log(theme.dim(`  (${toolBlocks.length} tool calls)`))
      }
    }
    console.log(theme.separator())
  }

  // Banner
  const gitBranch = await (async () => {
    try {
      const git = new Git(workingDir)
      return await git.isRepo() ? await git.branch() : null
    } catch { return null }
  })()

  console.log(theme.bold(`autocli v${VERSION}`))
  console.log(`${theme.dim('Model:')}   ${modelDisplayName(options.model)}`)
  console.log(`${theme.dim('Dir:')}     ${workingDir}`)
  if (gitBranch) console.log(`${theme.dim('Branch:')}  ${gitBranch}`)
  console.log(`${theme.dim('Type')} ${theme.info('/help')} ${theme.dim('for commands')}`)

  // Start scheduler if there are enabled schedules
  if (scheduleStore.list().some(s => s.enabled)) {
    scheduler.start()
    console.log(theme.dim(`Scheduler active (${scheduleStore.list().filter(s => s.enabled).length} schedules)`))
  }

  // Check for updates (non-blocking)
  checkForUpdate().then(v => {
    if (v) {
      const notice = showUpdateNotice(v, VERSION)
      if (notice) console.log(theme.warning(notice))
    }
  }).catch(() => {})

  // Input history
  const inputHistory = new InputHistory(join(platform.configDir, 'history'))
  const cmdNames = commandRegistry.list().map(c => c.name)

  // Plan mode state
  let planModeState = false

  // Spinner helper
  let spinnerTimer: ReturnType<typeof setInterval> | null = null
  const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let spinnerIdx = 0
  let spinnerMsg = ''
  let spinnerStart = 0

  const startSpinner = (msg: string) => {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null }
    spinnerMsg = msg
    spinnerIdx = 0
    spinnerStart = Date.now()
    process.stdout.write('\x1B[?25l')
    spinnerTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - spinnerStart) / 1000)
      process.stderr.write(`\r\x1B[K${theme.info(FRAMES[spinnerIdx % FRAMES.length])} ${spinnerMsg} ${theme.dim(`${elapsed}s`)}`)
      spinnerIdx++
    }, 80)
  }
  const updateSpinner = (msg: string) => { spinnerMsg = msg }
  const stopSpinner = () => {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null }
    process.stderr.write('\r\x1B[K')
    process.stdout.write('\x1B[?25h')
  }

  // REPL loop
  let turnCount = 0
  while (true) {
    const input = await readInput(theme.info('> '), inputHistory.getEntries(), cmdNames)
    inputHistory.add(input)

    if (!input.trim()) continue
    if (input.trim() === '/exit' || input.trim() === '/quit') {
      if (!session) session = sessionStore.create(workingDir)
      session.messages = messages
      session.totalCost = tokenCounter.cost
      session.totalTokens = { in: tokenCounter.inputTokens, out: tokenCounter.outputTokens }
      sessionStore.save(session)
      console.log(theme.dim(`Session saved: ${session.id}`))
      scheduler.stop()
      process.exit(0)
    }

    // Check for commands (starts with /)
    if (input.trim().startsWith('/')) {
      const result = await commandRegistry.execute(input.trim().slice(1), {
        workingDir,
        sessionId: session?.id || '',
        messages,
        model: options.model,
        totalTokens: { input: tokenCounter.inputTokens, output: tokenCounter.outputTokens },
        totalCost: tokenCounter.cost,
      })

      if (!result) {
        console.log(theme.error(`Unknown command: ${input.trim()}`))
        continue
      }

      if (result.output) {
        console.log(result.output)
      }

      if (result.type === 'prompt') {
        messages.push({ role: 'user', content: [{ type: 'text', text: result.prompt! }] })
      } else if (result.type === 'plan_toggle') {
        planModeState = !planModeState
        console.log(planModeState ? theme.warning('Plan mode ON — write tools disabled.') : theme.success('Plan mode OFF.'))
        continue
      } else if (result.type === 'yolo_toggle') {
        const mode = permissionGate.mode
        const newMode = mode === 'auto-approve' ? 'default' : 'auto-approve'
        permissionGate.setMode(newMode as 'default' | 'auto-approve')
        console.log(newMode === 'auto-approve'
          ? theme.warning('YOLO mode ON — all tools auto-approved.')
          : theme.success('YOLO mode OFF — approval required for write tools.'))
        continue
      } else if (result.type === 'team_status') {
        const teams = teamManager.list()
        if (teams.length === 0) {
          console.log(theme.dim('No active teams.'))
        } else {
          for (const team of teams) {
            const done = team.workers.filter(w => w.status === 'completed').length
            console.log(`  ${theme.info(team.name)} ${theme.dim(`(${done}/${team.workers.length} done)`)}`)
            for (const w of team.workers) {
              const icon = w.status === 'running' ? theme.info('>') : w.status === 'completed' ? theme.success('v') : w.status === 'failed' ? theme.error('x') : theme.dim('o')
              console.log(`    ${icon} ${w.name} ${theme.dim(`[${w.status}]`)}`)
            }
          }
        }
        continue
      } else if (result.type === 'full_status') {
        const allTeams = teamManager.list()
        if (allTeams.length > 0) {
          console.log(theme.bold('Teams:'))
          for (const team of allTeams) {
            const done = team.workers.filter(w => w.status === 'completed').length
            console.log(`  ${theme.info(team.name)} ${theme.dim(`(${done}/${team.workers.length} done)`)}`)
          }
        } else {
          console.log(theme.dim('No active teams.'))
        }

        const bgTasks = bgTaskManager.list()
        console.log('')
        if (bgTasks.length > 0) {
          console.log(theme.bold('Background Tasks:'))
          for (const t of bgTasks) {
            const icon = t.exitCode === null ? theme.info('>') : t.exitCode === 0 ? theme.success('v') : theme.error('x')
            console.log(`  ${icon} ${t.id} ${theme.dim(t.command.slice(0, 50))}`)
          }
        } else {
          console.log(theme.dim('No background tasks.'))
        }

        console.log('')
        const schedules = scheduleStore.list()
        if (schedules.length > 0) {
          console.log(theme.bold('Schedules:'))
          for (const s of schedules) {
            const icon = s.enabled ? theme.success('*') : theme.dim('o')
            console.log(`  ${icon} ${theme.info(s.teamName)} every ${s.interval} ${theme.dim(s.enabled ? 'enabled' : 'disabled')}`)
          }
        } else {
          console.log(theme.dim('No schedules.'))
        }
        console.log('')
        continue
      } else if (result.type === 'list_bg_tasks') {
        const tasks = bgTaskManager.list()
        if (tasks.length === 0) {
          console.log(theme.dim('No background tasks running.'))
        } else {
          for (const t of tasks) {
            const icon = t.exitCode === null ? theme.info('>') : t.exitCode === 0 ? theme.success('v') : theme.error('x')
            const elapsed = Math.round((Date.now() - new Date(t.startedAt).getTime()) / 1000)
            console.log(`  ${icon} ${t.id} (${elapsed}s) ${theme.dim(t.command.slice(0, 60))}`)
          }
        }
        continue
      } else if (result.type === 'permissions_show') {
        console.log(`Permission mode: ${permissionGate.mode}`)
        continue
      } else if (result.type === 'permissions_set_mode') {
        const mode = result.mode as 'default' | 'auto-approve' | 'deny-all' | 'llm-confirm'
        permissionGate.setMode(mode)
        console.log(theme.success(`Permission mode set to: ${mode}`))
        continue
      } else if (result.type === 'permissions_add_rule') {
        const rule = result.rule as { tool: string; pattern?: string; decision: 'allow' | 'deny' }
        permissionGate.addRule(rule)
        console.log(theme.success(`Rule added: ${rule.decision} ${rule.tool}${rule.pattern ? ` ${rule.pattern}` : ''}`))
        continue
      } else if (result.type === 'permissions_remove_rule') {
        const tool = (result as any).tool as string | undefined
        if (tool) permissionGate.removeRule(tool)
        console.log(theme.success('Rule removed'))
        continue
      } else if (result.type === 'permissions_reset') {
        permissionGate.setMode('default')
        console.log(theme.success('Permissions reset to defaults'))
        continue
      } else if (result.type === 'team_save') {
        const saveName = (result as any).saveName as string
        const teams = teamManager.list()
        if (teams.length === 0) {
          console.log(theme.error('No active team to save'))
        } else {
          console.log(theme.success(`Team "${saveName}" noted. Use /deploy to create persistent team templates.`))
        }
        continue
      } else if (result.type === 'run_team') {
        const teamName = (result as any).team as string
        console.log(theme.info(`Running team "${teamName}"...`))
        console.log(theme.dim('Use --run-team flag or /deploy for scheduled team execution.'))
        continue
      } else if (!result.type || result.type === 'text') {
        continue
      } else {
        continue
      }
    } else {
      // Regular user input
      messages.push({ role: 'user', content: [{ type: 'text', text: input }] })
      console.log(theme.info('▸ ') + theme.bold(input))
    }

    // Track message count before engine run for rollback on error
    const messageCountBeforeTurn = messages.length

    // Emit event for user input
    eventBus.emit('agent_start', { input })

    // Run hooks
    await hookRunner.run('before_tool_call', undefined, { input })

    // Query LLM — start spinner
    startSpinner('Thinking...')
    const startTime = Date.now()
    const prevCost = tokenCounter.cost

    // Show tool call/result status
    const onToolCall = (data: Record<string, unknown>) => {
      const name = data.name as string
      const toolInput = data.input as Record<string, unknown>
      let detail = ''
      if (name === 'Bash' && toolInput?.command) detail = `: ${String(toolInput.command).slice(0, 60)}`
      else if (name === 'Read' && toolInput?.file_path) detail = `: ${String(toolInput.file_path)}`
      else if (name === 'Write' && toolInput?.file_path) detail = `: ${String(toolInput.file_path)}`
      else if (name === 'Edit' && toolInput?.file_path) detail = `: ${String(toolInput.file_path)}`
      else if (name === 'Glob' && toolInput?.pattern) detail = `: ${String(toolInput.pattern)}`
      else if (name === 'Grep' && toolInput?.pattern) detail = `: ${String(toolInput.pattern)}`
      else if (name === 'WebSearch' && toolInput?.query) detail = `: ${String(toolInput.query)}`
      else if (name === 'WebFetch' && toolInput?.url) detail = `: ${String(toolInput.url).slice(0, 60)}`
      stopSpinner()
      console.log(theme.dim(`  ┌ ${theme.info(`[${name}]`)}${theme.dim(detail)}`))
      startSpinner(`Running ${name}...`)
    }
    const onToolResult = (data: Record<string, unknown>) => {
      const isError = data.isError as boolean
      const output = data.output as string || ''
      const preview = output.split('\n')[0].slice(0, 80)
      const icon = isError ? theme.error('✗') : theme.success('✓')
      stopSpinner()
      console.log(theme.dim(`  └ ${icon} ${theme.dim(preview)}`))
      startSpinner('Thinking...')
    }
    const onError = (data: Record<string, unknown>) => {
      const tool = data.tool as string || 'unknown'
      const error = data.error as string || 'unknown error'
      stopSpinner()
      console.log(theme.error(`  ✗ [${tool}] ${error.slice(0, 100)}`))
      startSpinner('Thinking...')
    }
    const onApprovalReq = (data: Record<string, unknown>) => {
      const tool = data.tool as string
      const method = data.method as string
      stopSpinner()
      console.log(theme.warning(`  ⚡ Permission requested: ${tool} (${method})`))
    }
    const onApprovalRes = (data: Record<string, unknown>) => {
      const tool = data.tool as string
      const allowed = data.allowed as boolean
      const reason = data.reason as string | undefined
      const icon = allowed ? theme.success('✓') : theme.error('✗')
      const detail = reason ? ` (${reason})` : ''
      console.log(theme.dim(`  ${icon} Permission ${allowed ? 'granted' : 'denied'}: ${tool}${detail}`))
      startSpinner('Thinking...')
    }

    eventBus.on('tool_call', onToolCall)
    eventBus.on('tool_result', onToolResult)
    eventBus.on('error', onError)
    eventBus.on('approval_req', onApprovalReq)
    eventBus.on('approval_res', onApprovalRes)

    currentAbortController = new AbortController()
    const messagesBeforeRun = [...messages]
    try {
      let streamedAny = false
      let lastCharWasNewline = false
      const onText = (text: string) => {
        if (spinnerTimer) stopSpinner()
        let output = ''
        for (const ch of text) {
          if (ch === '\n') {
            output += '\n'
            lastCharWasNewline = true
          } else {
            if (!streamedAny) {
              output += theme.success('◂ ')
              streamedAny = true
            } else if (lastCharWasNewline) {
              output += theme.dim('  ')
            }
            output += ch
            lastCharWasNewline = false
          }
        }
        if (output) process.stdout.write(output)
      }
      const runSubAgent = async (prompt: string, _opts?: { model?: string; provider?: string; background?: boolean }): Promise<string> => {
        const subMessages: Message[] = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
        let output = ''
        const result = await engine.run(subMessages, workingDir, (text) => { output += text })
        const responseText = result.response.content
          .filter(b => b.type === 'text')
          .map(b => b.text || '')
          .join('')
        return output || responseText
      }
      const engineSharedState: Record<string, unknown> = {
        planMode: planModeState,
        readSingleLine: readSingleLine,
        backgroundTaskManager: bgTaskManager,
        runSubAgent,
      }
      const result = await engine.run(messages, workingDir, onText, engineSharedState)
      if (typeof engineSharedState.planMode === 'boolean') planModeState = engineSharedState.planMode
      stopSpinner()
      if (streamedAny) process.stdout.write('\n')
      messages = result.messages

      // Auto-title session from first user message
      if (session && !session.title && messages.length >= 2) {
        const firstMsg = messages.find(m => m.role === 'user')
        if (firstMsg) {
          const text = firstMsg.content.filter(b => b.type === 'text').map(b => b.text || '').join('')
          if (text) session.title = text.slice(0, 60) + (text.length > 60 ? '...' : '')
        }
      }

      const turnCost = tokenCounter.cost - prevCost
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(theme.dim(`  └ ${elapsed}s | ${tokenCounter.format()} | $${turnCost.toFixed(4)}`))

      // Auto-compact if context is getting too large
      if (contextManager.needsCompaction(messages)) {
        console.log(theme.dim('Auto-compacting context...'))
        messages = contextManager.fitToContext(messages)
        console.log(theme.dim(`Compacted to ${messages.length} messages`))
      }
    } catch (err) {
      stopSpinner()
      messages = messagesBeforeRun.slice(0, messageCountBeforeTurn)
      if ((err as Error).name !== 'AbortError') {
        console.log(formatError((err as Error).message))
      }
    }
    currentAbortController = null
    eventBus.off('tool_call', onToolCall)
    eventBus.off('tool_result', onToolResult)
    eventBus.off('error', onError)
    eventBus.off('approval_req', onApprovalReq)
    eventBus.off('approval_res', onApprovalRes)

    // Run hooks
    await hookRunner.run('after_tool_call')

    // Emit event
    eventBus.emit('agent_done', {})

    // Auto-save session periodically
    if (!session) session = sessionStore.create(workingDir)
    session.messages = messages
    session.totalCost = tokenCounter.cost
    session.totalTokens = { in: tokenCounter.inputTokens, out: tokenCounter.outputTokens }
    sessionStore.save(session)

    // Auto-extract memories every 5 turns
    turnCount++
    if (turnCount % 5 === 0 && messages.length > 0) {
      const existingNames = memoryStore.list().map(e => e.name)
      extractMemories(messages, provider, memoryStore, existingNames).catch(() => {})
    }
  }
}
