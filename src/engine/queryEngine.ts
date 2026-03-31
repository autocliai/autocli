import Anthropic from '@anthropic-ai/sdk'
import type { ToolRegistry } from '../tools/registry.js'
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
    return [
      'You are a coding assistant. You help users with software engineering tasks.',
      `Working directory: ${workingDir}`,
      `Platform: ${process.platform}`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
      this.config.systemPrompt || '',
      this.config.memoryPrompt || '',
      this.config.skillsPrompt || '',
    ].filter(Boolean).join('\n')
  }

  async run(
    messages: Message[],
    workingDir: string,
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

      if (loopCount > maxLoops) {
        if (!this.config.headless) {
          console.log(theme.warning(`Tool loop limit reached (${maxLoops}). Stopping.`))
        }
        break
      }

      if (!this.config.headless) spinner.start()

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

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 8192,
        system: systemPrompt,
        messages: apiMessages,
        tools: tools as Anthropic.Tool[],
      })

      if (!this.config.headless) spinner.stop()

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
          if (!this.config.headless) {
            console.log(renderMarkdown(block.text))
          }
          this.config.onText?.(block.text)
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

// Sub-agent function (used by agent tool)
export async function runSubAgent(
  prompt: string,
  _description: string,
  context: ToolContext,
): Promise<string> {
  const { getGlobalEngine } = await import('../repl.js')
  const engine = getGlobalEngine()

  if (!engine) {
    return 'Error: query engine not initialized'
  }

  const messages: Message[] = [{ role: 'user', content: prompt }]
  const { response } = await engine.run(messages, context.workingDir)

  if (typeof response.content === 'string') return response.content

  return response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n')
}
