import Anthropic from '@anthropic-ai/sdk'
import { ToolRegistry } from '../tools/registry.js'
import type { TokenCounter } from './tokenCounter.js'
import type { ContextManager } from './contextManager.js'
import type { ToolContext, ToolResult, ToolCall } from '../tools/types.js'
import type { Message, ContentBlock } from '../commands/types.js'
import { PermissionGate } from '../permissions/permissionGate.js'
import type { PermissionConfig } from '../permissions/types.js'
import { Spinner } from '../ui/spinner.js'
import { formatToolUse, formatToolResult, formatGroupedTools } from '../ui/toolResult.js'
import { theme } from '../ui/theme.js'
import { applyInlineMarkdown } from '../ui/streamMarkdown.js'
import { StreamRenderer } from '../ui/stream.js'
import { getLayout } from '../ui/fullscreen.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `You are an expert coding assistant. You help users with software engineering tasks including writing code, debugging, refactoring, and explaining concepts.

# Core Principles
- Read before writing. Always read a file before modifying it. Understand existing code before suggesting changes.
- Make minimal changes. Only modify what's needed to accomplish the task. Don't refactor surrounding code unless asked.
- Prefer editing existing files over creating new ones. This prevents file bloat and builds on existing work.
- Be concise. Lead with the answer or action, not reasoning. Skip filler words and preamble.

# Tool Usage
- Use Read to read files, not Bash with cat/head/tail.
- Use Edit for modifying files, not Bash with sed/awk. Edit performs exact string replacement — the old_string must match exactly.
- Use Write only for creating new files or complete rewrites. For existing files, prefer Edit.
- Use Glob to find files by name pattern, not Bash with find/ls.
- Use Grep to search file contents, not Bash with grep/rg.
- Use Bash only for running commands, installing packages, running tests, and git operations.
- When running shell commands, quote file paths with spaces.
- Use WebSearch to search the web for information. Use WebFetch to fetch and read a specific URL.

# Code Quality
- Write safe, secure code. Avoid command injection, XSS, SQL injection.
- Don't add unnecessary error handling, comments, type annotations, or abstractions.
- Follow existing code conventions in the project.
- Three similar lines of code is better than a premature abstraction.

# Git Protocol
- Never amend commits unless explicitly asked. Create new commits.
- Never force push or use destructive git operations without explicit permission.
- Never skip hooks (--no-verify) unless asked.
- Stage specific files, not "git add -A" which can include secrets.

# When You're Stuck
- If a task is unclear, ask for clarification before proceeding.
- If an approach fails, diagnose why before switching tactics.
- Read error messages carefully — they usually tell you what's wrong.`

export interface QueryEngineConfig {
  apiKey: string
  model: string
  maxTokens?: number
  maxToolLoops?: number
  toolRegistry: ToolRegistry
  tokenCounter: TokenCounter
  contextManager: ContextManager
  permissionConfig?: PermissionConfig
  systemPrompt?: string
  memoryPrompt?: string
  skillsPrompt?: string
  claudeMdPrompt?: string
  gitContext?: string
  projectHint?: string
  brainContext?: string
  onText?: (text: string) => void
  onToolUse?: (name: string, input: Record<string, unknown>) => void
  onToolResult?: (name: string, result: ToolResult) => void
  headless?: boolean
  maxSessionCost?: number
  planMode?: boolean
  provider?: 'anthropic' | 'openai' | 'claude-local' | 'minimaxi-cn'
  openaiApiKey?: string
  openaiBaseUrl?: string
  minimaxiApiKey?: string
  minimaxiBaseUrl?: string
  minimaxiModel?: string
  claudeLocalConfig?: import('../providers/claudeLocal.js').ClaudeLocalConfig
  wire?: import('../wire/wire.js').Wire
  hookRunner?: import('../hooks/hookRunner.js').HookRunner
  bgTaskManager?: import('../tasks/backgroundTask.js').BackgroundTaskManager
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  headless = false,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const error = err as Error & { status?: number }
      const status = error.status || 0

      // Retry on rate limit (429) or overloaded (529)
      if ((status === 429 || status === 529) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // exponential backoff, max 30s
        if (!headless) {
          getLayout().log(theme.warning(`Rate limited (${status}). Retrying in ${delay / 1000}s... (${attempt + 1}/${maxRetries})`))
        }
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export class QueryEngine {
  private client: Anthropic
  private config: QueryEngineConfig
  private permissionGate: PermissionGate

  constructor(config: QueryEngineConfig) {
    this.config = config
    // Ensure permissionConfig is always stored so setPermissionMode/getPermissionMode work
    if (!this.config.permissionConfig) {
      this.config.permissionConfig = { mode: 'default', rules: [], alwaysAllow: new Set() }
    }
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.permissionGate = new PermissionGate(this.config.permissionConfig)
  }

  // ── Public accessors (avoids bracket-notation private access) ──

  setHookRunner(hookRunner: QueryEngineConfig['hookRunner']): void { this.config.hookRunner = hookRunner }
  setBgTaskManager(mgr: QueryEngineConfig['bgTaskManager']): void { this.config.bgTaskManager = mgr }
  setWire(wire: QueryEngineConfig['wire']): void { this.config.wire = wire }
  setPermissionWire(wire: QueryEngineConfig['wire']): void { (this.permissionGate as { wire?: unknown }).wire = wire }
  setBrainContext(ctx: string): void { this.config.brainContext = ctx }

  setModel(model: string): void { this.config.model = model }
  getModel(): string { return this.config.model }
  setProvider(provider: QueryEngineConfig['provider']): void { this.config.provider = provider }
  getProvider(): string | undefined { return this.config.provider }

  setPlanMode(on: boolean): void { this.config.planMode = on }
  getPlanMode(): boolean { return this.config.planMode || false }

  setPermissionMode(mode: 'default' | 'auto-approve' | 'deny-all'): void {
    this.config.permissionConfig!.mode = mode
    this.permissionGate.setMode(mode)
  }
  getPermissionMode(): string { return this.config.permissionConfig?.mode || 'default' }
  getPermissionConfig(): PermissionConfig { return this.config.permissionConfig! }

  getToolRegistry(): ToolRegistry { return this.config.toolRegistry }
  getWire(): QueryEngineConfig['wire'] { return this.config.wire }

  /** Expose config for sub-engine construction (used by buildSubEngine) */
  getConfigSnapshot(): QueryEngineConfig { return { ...this.config } }

  buildSystemPrompt(workingDir: string): string {
    return [
      SYSTEM_PROMPT,
      `Working directory: ${workingDir}`,
      `Platform: ${process.platform}`,
      `Shell: ${process.env.SHELL || '/bin/bash'}`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
      this.config.systemPrompt || '',
      this.config.memoryPrompt || '',
      this.config.skillsPrompt || '',
      this.config.claudeMdPrompt || '',
      this.config.gitContext || '',
      this.config.projectHint || '',
      this.config.brainContext || '',
    ].filter(Boolean).join('\n\n')
  }

  async run(
    messages: Message[],
    workingDir: string,
    abortSignal?: AbortSignal,
  ): Promise<{ response: Message; messages: Message[] }> {
    const spinner = new Spinner('Thinking...')
    if (!this.config.headless) spinner.start()

    const fitted = this.config.contextManager.fitToContext(messages)
    const systemPrompt = this.buildSystemPrompt(workingDir)
    const tools = this.config.toolRegistry.toApiSchemas()
    const sharedState: Record<string, unknown> = {}
    if (this.config.bgTaskManager) sharedState.bgTaskManager = this.config.bgTaskManager
    const toolContext: ToolContext = {
      workingDir,
      sharedState,
      onProgress: this.config.headless ? undefined : (text: string) => {
        getLayout().log(theme.dim(text))
      },
    }

    const maxLoops = this.config.maxToolLoops || 40
    let loopCount = 0

    const streamRenderer = new StreamRenderer(!this.config.headless)
    let currentMessages = [...fitted]
    let continueLoop = true

    const ensureSpinnerStopped = () => {
      if (spinner.isRunning && !this.config.headless) spinner.stop()
    }

    try {
    while (continueLoop) {
      continueLoop = false
      loopCount++

      // Check for cancellation
      if (abortSignal?.aborted) break

      if (loopCount > maxLoops) {
        if (!this.config.headless) {
          getLayout().log(theme.warning(`Tool loop limit reached (${maxLoops}). Stopping.`))
        }
        break
      }

      // Convert internal messages to Anthropic API format
      const apiMessages: Anthropic.MessageParam[] = currentMessages.map(m => {
        if (typeof m.content === 'string') {
          return { role: m.role as 'user' | 'assistant', content: m.content }
        }
        // Map ContentBlock[] to Anthropic-compatible blocks
        const blocks = m.content.map(block => {
          if (block.type === 'tool_result') {
            return {
              type: 'tool_result' as const,
              tool_use_id: block.tool_use_id,
              content: block.content,
              is_error: block.is_error,
            }
          }
          if (block.type === 'tool_use') {
            return {
              type: 'tool_use' as const,
              id: block.id,
              name: block.name,
              input: block.input,
            }
          }
          return { type: 'text' as const, text: block.text }
        })
        return { role: m.role as 'user' | 'assistant', content: blocks }
      })

      if (!this.config.headless && !spinner.isRunning) spinner.start()

      let spinnerStopped = false
      const stopSpinnerOnce = () => {
        if (!spinnerStopped && !this.config.headless) {
          spinner.stop()
          spinnerStopped = true
        }
      }

      let response: Anthropic.Message

      if (this.config.provider === 'claude-local') {
        const { callClaudeLocal } = await import('../providers/claudeLocal.js')

        const localResult = await callClaudeLocal({
          system: systemPrompt,
          messages: apiMessages as Array<{ role: string; content: unknown }>,
          config: this.config.claudeLocalConfig,
          onText: (text) => {
            stopSpinnerOnce()
            streamRenderer.write(text)
            this.config.onText?.(text)
            this.config.wire?.emit('text', { text })
          },
          abortSignal,
        })
        stopSpinnerOnce()

        // Claude-local handles tools internally — wrap as text-only response
        response = {
          id: `local-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: this.config.model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          content: localResult.content.map(b => {
            if (b.type === 'tool_use') {
              return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input }
            }
            return { type: 'text' as const, text: b.text }
          }),
          usage: { input_tokens: localResult.usage.input_tokens, output_tokens: localResult.usage.output_tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        } as unknown as Anthropic.Message
      } else if (this.config.provider === 'openai' || this.config.provider === 'minimaxi-cn') {
        const { callOpenAI, buildOpenAIConfig } = await import('../providers/openai.js')
        const isMinimaxi = this.config.provider === 'minimaxi-cn'
        const oaiConfig = buildOpenAIConfig({
          provider: 'openai',
          apiKey: isMinimaxi ? (this.config.minimaxiApiKey || this.config.apiKey) : (this.config.openaiApiKey || this.config.apiKey),
          baseUrl: isMinimaxi ? (this.config.minimaxiBaseUrl || 'https://www.minimaxi.com/v1') : this.config.openaiBaseUrl,
          model: isMinimaxi ? (this.config.minimaxiModel || 'miniMax-2.7') : this.config.model,
        })
        const oaiResult = await withRetry(async () => {
          return await callOpenAI({
            apiKey: oaiConfig.apiKey,
            baseUrl: oaiConfig.baseUrl,
            model: oaiConfig.model,
            maxTokens: this.config.maxTokens || 8192,
            system: systemPrompt,
            messages: apiMessages as Array<{ role: string; content: unknown }>,
            tools: tools as Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
            stream: true,
            onText: (text) => {
              stopSpinnerOnce()
              streamRenderer.write(text)
              this.config.onText?.(text)
              this.config.wire?.emit('text', { text })
            },
          })
        }, 3, !!this.config.headless)
        stopSpinnerOnce()

        // For non-streamed text blocks (tool-only responses), render them
        for (const block of oaiResult.content) {
          if (block.type === 'text' && !streamRenderer.hasContent()) {
            if (!this.config.headless) {
              const formatted = block.text.split('\n').map(l => applyInlineMarkdown(l)).join('\n')
              getLayout().writeOutput(formatted)
            }
            streamRenderer.capture(block.text)
            this.config.onText?.(block.text)
          }
        }

        // Wrap into Anthropic.Message shape for uniform downstream handling
        response = {
          id: `oai-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: this.config.model,
          stop_reason: oaiResult.content.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
          stop_sequence: null,
          content: oaiResult.content.map(b => {
            if (b.type === 'tool_use') {
              return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input }
            }
            return { type: 'text' as const, text: b.text }
          }),
          usage: { input_tokens: oaiResult.usage.input_tokens, output_tokens: oaiResult.usage.output_tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        } as unknown as Anthropic.Message
      } else {
        response = await withRetry(async () => {
          const s = this.client.messages.stream({
            model: this.config.model,
            max_tokens: this.config.maxTokens || 8192,
            system: systemPrompt,
            messages: apiMessages,
            tools: tools as Anthropic.Tool[],
          })

          // Abort the stream if the signal fires
          let onAbort: (() => void) | undefined
          if (abortSignal) {
            onAbort = () => s.abort()
            abortSignal.addEventListener('abort', onAbort, { once: true })
          }

          s.on('text', (text) => {
            stopSpinnerOnce()
            streamRenderer.write(text) // Buffers and writes to stdout (unless headless)
            this.config.onText?.(text)
            this.config.wire?.emit('text', { text })
          })

          try {
            return await s.finalMessage()
          } finally {
            if (abortSignal && onAbort) {
              abortSignal.removeEventListener('abort', onAbort)
            }
          }
        }, 3, !!this.config.headless)
        stopSpinnerOnce() // In case no text was emitted (pure tool_use response)
      }

      streamRenderer.newline()

      // Emit text_done wire event with collected content
      this.config.wire?.emit('text_done', { content: streamRenderer.getContent() })
      streamRenderer.clear()

      // Track tokens
      this.config.tokenCounter.add({
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      })

      // Check cost limit
      if (this.config.maxSessionCost && this.config.tokenCounter.totalCost >= this.config.maxSessionCost) {
        if (!this.config.headless) {
          const { showAlert } = await import('../ui/dialog.js')
          await showAlert('Cost Limit Reached', `Session cost $${this.config.tokenCounter.totalCost.toFixed(4)} exceeded limit $${this.config.maxSessionCost}. Use /cost to check usage.`)
        }
        break
      }

      // Process response blocks
      const assistantBlocks: ContentBlock[] = []
      const toolResults: ContentBlock[] = []

      const layout = getLayout()

      for (const block of response.content) {
        if (block.type === 'thinking') {
          const thinkingText = (block as { thinking: string }).thinking || ''
          if (!this.config.headless && thinkingText) {
            layout.log(theme.dim('💭 Thinking...'))
            layout.log(theme.dim('  ' + thinkingText.slice(0, 200) + (thinkingText.length > 200 ? '...' : '')))
          }
          // Don't store thinking blocks in messages — they waste tokens and confuse the model
        }

        if (block.type === 'text') {
          assistantBlocks.push({ type: 'text', text: block.text })
          // Text already streamed above — don't re-render
        }

        if (block.type === 'tool_use') {
          const toolName = block.name
          const toolInput = block.input as Record<string, unknown>
          assistantBlocks.push({ type: 'tool_use', id: block.id, name: toolName, input: toolInput })

          if (!this.config.headless) {
            layout.log(formatToolUse(toolName, toolInput))
          }
          this.config.onToolUse?.(toolName, toolInput)
          this.config.wire?.emit('tool_call', { name: toolName, input: toolInput })

          // Execute tool
          if (!this.config.toolRegistry) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Tool registry not initialized', is_error: true })
            continue
          }
          const tool = this.config.toolRegistry.get(toolName)
          if (!tool) {
            const errResult = { output: `Unknown tool: ${toolName}`, isError: true }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: errResult.output, is_error: true })
            continue
          }

          // Plan mode enforcement
          if (this.config.planMode && !tool.isReadOnly) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Tool blocked: plan mode is active (read-only). Use ExitPlanMode to return to full access.', is_error: true })
            if (!this.config.headless) layout.log(theme.warning('Blocked (plan mode).'))
            continue
          }

          // Skill allowedTools enforcement
          // Set by Skill tool to restrict which tools the skill can use
          const skillAllowed = sharedState.skillAllowedTools as string[] | undefined
          if (skillAllowed && !skillAllowed.includes(toolName)) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Tool blocked: current skill restricts tools to [${skillAllowed.join(', ')}]. "${toolName}" is not allowed.`, is_error: true })
            if (!this.config.headless) layout.log(theme.warning(`Blocked by skill restriction.`))
            continue
          }

          // Fire before_tool_call hook (before permission to avoid wasting user's time)
          if (this.config.hookRunner) {
            const hookResult = await this.config.hookRunner.run('before_tool_call', { tool: toolName, input: JSON.stringify(toolInput) })
            if (hookResult.blocked) {
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Tool blocked by hook: ${hookResult.stderr || hookResult.stdout || 'hook returned non-zero'}`, is_error: true })
              if (!this.config.headless) layout.log(theme.warning(`Blocked by hook.`))
              continue
            }
          }

          // Permission check
          const allowed = await this.permissionGate.check(toolName, toolInput, tool.isReadOnly)
          if (!allowed) {
            const denyResult = { output: 'Tool call denied by user.', isError: true }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: denyResult.output, is_error: true })
            if (!this.config.headless) layout.log(theme.warning('Denied.'))
            continue
          }

          // Dynamic spinner verb
          if (!this.config.headless) {
            const hint = toolInput.file_path || toolInput.command || toolInput.pattern || toolInput.prompt || ''
            const hintStr = typeof hint === 'string' ? hint.slice(0, 50) : ''
            spinner.update(`${toolName} ${hintStr}...`.trim())
            spinner.start()
          }
          let result: ToolResult
          try {
            result = await tool.call(toolInput, toolContext)
          } catch (err) {
            const errMsg = (err as Error).message
            result = { output: `Tool crashed: ${errMsg}`, isError: true }
            logger.error('Tool execution failed', { tool: toolName, error: errMsg })
            this.config.wire?.emit('error', { tool: toolName, message: errMsg })
            this.config.hookRunner?.run('on_error', { tool: toolName, error: errMsg }).catch(() => {})
          }
          if (!this.config.headless) {
            spinner.stop()
            layout.log(formatToolResult(toolName, result.output, result.isError))
          }
          this.config.onToolResult?.(toolName, result)
          this.config.wire?.emit('tool_result', { name: toolName, output: result.output, isError: result.isError })

          // Fire after_tool_call hook
          this.config.hookRunner?.run('after_tool_call', { tool: toolName, output: result.output.slice(0, 500), isError: String(!!result.isError) }).catch(() => {})

          // Handle plan mode toggles
          if (toolName === 'EnterPlanMode') this.config.planMode = true
          if (toolName === 'ExitPlanMode') this.config.planMode = false

          // Cap tool result at 100KB
          const MAX_RESULT_BYTES = 100_000
          if (result.output.length > MAX_RESULT_BYTES) {
            result = {
              output: result.output.slice(0, MAX_RESULT_BYTES) + `\n\n[Output truncated: ${result.output.length} chars exceeds ${MAX_RESULT_BYTES} limit]`,
              isError: result.isError,
            }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.output,
            is_error: result.isError,
          })
        }
      }

      // Add assistant response to messages (API requires at least one content block)
      if (assistantBlocks.length === 0) {
        assistantBlocks.push({ type: 'text', text: '' })
      }
      currentMessages.push({ role: 'assistant', content: assistantBlocks })

      // If there were tool calls, add results and continue the loop
      if (toolResults.length > 0) {
        // Show grouped tool summary when multiple tools were called
        const toolUseCount = assistantBlocks.filter(b => b.type === 'tool_use').length
        if (!this.config.headless && toolUseCount > 1) {
          const toolCalls: ToolCall[] = assistantBlocks
            .filter(b => b.type === 'tool_use')
            .map(b => ({ id: (b as { id: string }).id, name: (b as { name: string }).name, input: (b as { input: Record<string, unknown> }).input }))
          const toolSummaryItems = toolCalls.map(tc => {
              const tr = toolResults.find(r => r.type === 'tool_result' && r.tool_use_id === tc.id)
              return { name: tc.name, input: tc.input, output: tr ? (tr as { content: string }).content : '' }
            })
          const grouped = formatGroupedTools(toolSummaryItems)
          if (grouped) layout.log(grouped)
        }
        currentMessages.push({ role: 'user', content: toolResults })
        continueLoop = true
      }
    }

    } finally {
      ensureSpinnerStopped()
    }

    // Find the last assistant message (may not be the final message if loop hit limit)
    let lastAssistant: Message = { role: 'assistant', content: [{ type: 'text', text: '' }] }
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        lastAssistant = currentMessages[i]
        break
      }
    }
    // Clear skill tool restrictions after run completes
    delete sharedState.skillAllowedTools

    // Emit status wire event
    this.config.wire?.emit('status', {
      loopCount,
      messageCount: currentMessages.length,
      inputTokens: this.config.tokenCounter.totalInput,
      outputTokens: this.config.tokenCounter.totalOutput,
    })

    return { response: lastAssistant, messages: currentMessages }
  }
}

// Background agent management
export type BackgroundAgent = {
  id: string
  description: string
  notified: boolean
  startedAt: number
} & (
  | { status: 'running' }
  | { status: 'completed'; result: string }
  | { status: 'failed'; error: string }
)

export class BackgroundAgentManager {
  private agents = new Map<string, BackgroundAgent>()

  register(id: string, description: string): void {
    if (this.agents.size >= 50) this.cleanup()
    this.agents.set(id, {
      id, description, status: 'running', notified: false, startedAt: Date.now(),
    })
  }

  cleanup(): void {
    for (const [id, agent] of this.agents) {
      if (agent.notified && (agent.status === 'completed' || agent.status === 'failed')) {
        this.agents.delete(id)
      }
    }
  }

  get(id: string): BackgroundAgent | undefined {
    return this.agents.get(id)
  }

  complete(id: string, result: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      this.agents.set(id, {
        id: agent.id, description: agent.description, notified: agent.notified,
        startedAt: agent.startedAt, status: 'completed', result,
      })
    }
  }

  fail(id: string, error: string): void {
    const agent = this.agents.get(id)
    if (agent) {
      this.agents.set(id, {
        id: agent.id, description: agent.description, notified: agent.notified,
        startedAt: agent.startedAt, status: 'failed', error,
      })
    }
  }

  getPendingNotifications(): BackgroundAgent[] {
    const pending: BackgroundAgent[] = []
    for (const agent of this.agents.values()) {
      if ((agent.status === 'completed' || agent.status === 'failed') && !agent.notified) {
        agent.notified = true
        pending.push(agent)
      }
    }
    return pending
  }
}

// Sub-agent types and function
import { getAgentType, type AgentType } from '../tools/agentTypes.js'
import { resolveModel as resolveModelAlias } from '../utils/config.js'

export interface SubAgentOptions {
  subagentType?: string
  model?: string
  provider?: 'anthropic' | 'openai' | 'claude-local'
  runInBackground?: boolean
}

function buildSubEngine(
  parentEngine: QueryEngine,
  agentType: AgentType | undefined,
  parentRegistry: ToolRegistry,
  modelOverride?: string,
  providerOverride?: 'anthropic' | 'openai' | 'claude-local',
): QueryEngine {
  const subRegistry = new ToolRegistry()

  if (agentType?.allowedTools) {
    for (const tool of parentRegistry.list()) {
      if (agentType.allowedTools.includes(tool.name)) {
        subRegistry.register(tool)
      }
    }
  } else {
    for (const tool of parentRegistry.list()) {
      subRegistry.register(tool)
    }
  }

  const parentConfig = parentEngine.getConfigSnapshot()

  const resolvedModel = modelOverride
    ? resolveModelAlias(modelOverride, parentConfig.model)
    : parentConfig.model

  // Resolve provider: explicit override > agent type default > parent
  const resolvedProvider = providerOverride
    || agentType?.provider
    || parentConfig.provider

  return new QueryEngine({
    ...parentConfig,
    model: resolvedModel,
    provider: resolvedProvider,
    toolRegistry: subRegistry,
    systemPrompt: agentType?.systemPrompt,
    headless: true,
  })
}

export async function runSubAgent(
  prompt: string,
  _description: string,
  context: ToolContext,
  options?: SubAgentOptions,
): Promise<string> {
  const { getGlobalEngine } = await import('../repl.js')
  const engine = getGlobalEngine()

  if (!engine) {
    return 'Error: query engine not initialized'
  }

  // Background execution
  if (options?.runInBackground) {
    const { getBackgroundManager } = await import('../repl.js')
    const bgMgr = getBackgroundManager()
    if (bgMgr) {
      const agentId = `bg-${Date.now()}`
      bgMgr.register(agentId, _description)

      // Fire and forget
      const parentRegistry = engine.getToolRegistry()
      const agentType = options?.subagentType
        ? getAgentType(options.subagentType)
        : getAgentType('general-purpose')
      const subEngine = buildSubEngine(engine, agentType, parentRegistry, options?.model, options?.provider)
      ;(async () => {
        try {
          const msgs: Message[] = [{ role: 'user', content: prompt }]
          const { response } = await subEngine.run(msgs, context.workingDir)
          const text = typeof response.content === 'string'
            ? response.content
            : response.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map(b => b.text).join('\n')
          bgMgr.complete(agentId, text)
        } catch (err) {
          bgMgr.fail(agentId, (err as Error).message)
        }
      })()

      return `Agent launched in background (${agentId}). You will be notified when it completes.`
    }
  }

  const agentType = options?.subagentType
    ? getAgentType(options.subagentType)
    : getAgentType('general-purpose')

  const parentRegistry = engine.getToolRegistry()
  const subEngine = buildSubEngine(engine, agentType, parentRegistry, options?.model, options?.provider)

  // Emit agent_start wire event
  const agentId = `agent-${Date.now()}`
  engine.getWire()?.emit('agent_start', { id: agentId, description: _description, type: agentType?.name })

  const messages: Message[] = [{ role: 'user', content: prompt }]
  const { response } = await subEngine.run(messages, context.workingDir)

  const text = typeof response.content === 'string'
    ? response.content
    : response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('\n')

  // Emit agent_done wire event
  engine.getWire()?.emit('agent_done', { id: agentId, description: _description, resultLength: text.length })

  return text
}
