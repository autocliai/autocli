import Anthropic from '@anthropic-ai/sdk'
import { ToolRegistry } from '../tools/registry.js'
import type { TokenCounter } from './tokenCounter.js'
import type { ContextManager } from './contextManager.js'
import type { ToolContext, ToolResult } from '../tools/types.js'
import type { Message, ContentBlock } from '../commands/types.js'
import { PermissionGate } from '../permissions/permissionGate.js'
import type { PermissionConfig } from '../permissions/types.js'
import { Spinner } from '../ui/spinner.js'
import { renderMarkdown } from '../ui/markdown.js'
import { formatToolUse, formatToolResult } from '../ui/toolResult.js'
import { theme } from '../ui/theme.js'

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
  onText?: (text: string) => void
  onToolUse?: (name: string, input: Record<string, unknown>) => void
  onToolResult?: (name: string, result: ToolResult) => void
  headless?: boolean
}

export class QueryEngine {
  private client: Anthropic
  private config: QueryEngineConfig
  private permissionGate: PermissionGate

  constructor(config: QueryEngineConfig) {
    this.config = config
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.permissionGate = new PermissionGate(
      config.permissionConfig || { mode: 'default', rules: [], alwaysAllow: new Set() }
    )
  }

  buildSystemPrompt(workingDir: string): string {
    const corePrompt = `You are an expert coding assistant. You help users with software engineering tasks including writing code, debugging, refactoring, and explaining concepts.

# Environment
- Working directory: ${workingDir}
- Platform: ${process.platform}
- Date: ${new Date().toISOString().split('T')[0]}

# Tool Usage Guidelines
- Use Read to examine files before modifying them. Never edit a file you haven't read.
- Prefer Edit over Write for existing files — Edit makes surgical changes, Write replaces the entire file.
- Use Glob to find files by pattern, Grep to search content. Don't use Bash for file search.
- When using Bash, quote file paths with spaces. Avoid interactive commands (vim, less, etc.).
- For git operations, prefer specific file staging over "git add -A". Never force-push without asking.
- Break complex tasks into steps. Use TaskCreate to track progress on multi-step work.

# Code Quality
- Write clean, minimal code. Don't add features, comments, or abstractions beyond what was asked.
- Don't add error handling for scenarios that can't happen. Trust internal code.
- Prefer simple code over clever code. Three similar lines is better than a premature abstraction.
- Match the existing code style of the project.

# Communication
- Be concise. Lead with the answer, not the reasoning.
- When referencing code, include file paths with line numbers.
- Don't restate what the user said. Just do it.
- If unclear, ask before guessing.

# Safety
- Never write credentials, API keys, or secrets to files.
- Don't run destructive commands (rm -rf, git reset --hard, DROP TABLE) without confirmation.
- Don't push to remote repositories without explicit permission.`

    return [
      corePrompt,
      this.config.systemPrompt || '',
      this.config.memoryPrompt || '',
      this.config.skillsPrompt || '',
      this.config.claudeMdPrompt || '',
      this.config.gitContext || '',
    ].filter(Boolean).join('\n\n')
  }

  async run(
    messages: Message[],
    workingDir: string,
    abortSignal?: AbortSignal,
  ): Promise<{ response: Message; messages: Message[] }> {
    const fitted = this.config.contextManager.fitToContext(messages)
    const systemPrompt = this.buildSystemPrompt(workingDir)
    const tools = this.config.toolRegistry.toApiSchemas()
    const toolContext: ToolContext = { workingDir }

    const spinner = new Spinner('Thinking...')
    const maxLoops = this.config.maxToolLoops || 40
    let loopCount = 0

    let currentMessages = [...fitted]
    let continueLoop = true

    while (continueLoop) {
      continueLoop = false
      loopCount++

      // Check for cancellation
      if (abortSignal?.aborted) break

      if (loopCount > maxLoops) {
        if (!this.config.headless) {
          console.log(theme.warning(`Tool loop limit reached (${maxLoops}). Stopping.`))
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

      if (!this.config.headless) spinner.start()

      let spinnerStopped = false
      const stopSpinnerOnce = () => {
        if (!spinnerStopped && !this.config.headless) {
          spinner.stop()
          spinnerStopped = true
        }
      }

      const stream = this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 8192,
        system: systemPrompt,
        messages: apiMessages,
        tools: tools as Anthropic.Tool[],
      })

      stream.on('text', (text) => {
        stopSpinnerOnce()
        if (!this.config.headless) {
          process.stdout.write(text)
        }
        this.config.onText?.(text)
      })

      const response = await stream.finalMessage()
      stopSpinnerOnce() // In case no text was emitted (pure tool_use response)

      if (!this.config.headless) {
        process.stdout.write('\n')
      }

      // Track tokens
      this.config.tokenCounter.add({
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      })

      // Process response blocks
      const assistantBlocks: ContentBlock[] = []
      const toolResults: ContentBlock[] = []

      for (const block of response.content) {
        if (block.type === 'text') {
          assistantBlocks.push({ type: 'text', text: block.text })
          // Text already streamed above — don't re-render
        }

        if (block.type === 'tool_use') {
          const toolName = block.name
          const toolInput = block.input as Record<string, unknown>
          assistantBlocks.push({ type: 'tool_use', id: block.id, name: toolName, input: toolInput })

          if (!this.config.headless) {
            console.log(formatToolUse(toolName, toolInput))
          }
          this.config.onToolUse?.(toolName, toolInput)

          // Execute tool
          const tool = this.config.toolRegistry.get(toolName)
          if (!tool) {
            const errResult = { output: `Unknown tool: ${toolName}`, isError: true }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: errResult.output, is_error: true })
            continue
          }

          // Permission check
          const allowed = await this.permissionGate.check(toolName, toolInput, tool.isReadOnly)
          if (!allowed) {
            const denyResult = { output: 'Tool call denied by user.', isError: true }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: denyResult.output, is_error: true })
            if (!this.config.headless) console.log(theme.warning('Denied.'))
            continue
          }

          if (!this.config.headless) spinner.start()
          let result: ToolResult
          try {
            result = await tool.call(toolInput, toolContext)
          } catch (err) {
            result = { output: `Tool crashed: ${(err as Error).message}`, isError: true }
          }
          if (!this.config.headless) {
            spinner.stop()
            console.log(formatToolResult(toolName, result.output, result.isError))
          }
          this.config.onToolResult?.(toolName, result)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.output,
            is_error: result.isError,
          })
        }
      }

      // Add assistant response to messages
      currentMessages.push({ role: 'assistant', content: assistantBlocks })

      // If there were tool calls, add results and continue the loop
      if (toolResults.length > 0) {
        currentMessages.push({ role: 'user', content: toolResults })
        continueLoop = true
      }
    }

    // Find the last assistant message (may not be the final message if loop hit limit)
    let lastAssistant: Message = { role: 'assistant', content: [{ type: 'text', text: '' }] }
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        lastAssistant = currentMessages[i]
        break
      }
    }
    return { response: lastAssistant, messages: currentMessages }
  }
}

// Background agent management
export interface BackgroundAgent {
  id: string
  description: string
  status: 'running' | 'completed' | 'failed'
  result?: string
  error?: string
  notified: boolean
  startedAt: number
}

export class BackgroundAgentManager {
  private agents = new Map<string, BackgroundAgent>()

  register(id: string, description: string): void {
    this.agents.set(id, {
      id, description, status: 'running', notified: false, startedAt: Date.now(),
    })
  }

  get(id: string): BackgroundAgent | undefined {
    return this.agents.get(id)
  }

  complete(id: string, result: string): void {
    const agent = this.agents.get(id)
    if (agent) { agent.status = 'completed'; agent.result = result }
  }

  fail(id: string, error: string): void {
    const agent = this.agents.get(id)
    if (agent) { agent.status = 'failed'; agent.error = error }
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

export interface SubAgentOptions {
  subagentType?: string
  model?: string
  runInBackground?: boolean
}

const MODEL_MAP: Record<string, string> = {
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'haiku': 'claude-haiku-3-5-20241022',
}

function buildSubEngine(
  parentEngine: QueryEngine,
  agentType: AgentType | undefined,
  parentRegistry: ToolRegistry,
  modelOverride?: string,
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

  const resolvedModel = modelOverride
    ? MODEL_MAP[modelOverride] || modelOverride
    : parentEngine['config'].model

  return new QueryEngine({
    ...parentEngine['config'],
    model: resolvedModel,
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
      const parentRegistry = engine['config'].toolRegistry as ToolRegistry
      const agentType = options?.subagentType
        ? getAgentType(options.subagentType)
        : getAgentType('general-purpose')
      const subEngine = buildSubEngine(engine, agentType, parentRegistry, options?.model)
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

  const parentRegistry = engine['config'].toolRegistry as ToolRegistry
  const subEngine = buildSubEngine(engine, agentType, parentRegistry, options?.model)

  const messages: Message[] = [{ role: 'user', content: prompt }]
  const { response } = await subEngine.run(messages, context.workingDir)

  if (typeof response.content === 'string') return response.content

  return response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n')
}
