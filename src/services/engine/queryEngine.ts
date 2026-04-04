import type { LLMProvider, Message, ContentBlock, StreamChunk, RunResult } from '../providers/types.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { ToolContext, ToolCall } from '../tools/types.js'
import { ToolExecutor } from './toolExecutor.js'
import { ContextManager } from './contextManager.js'
import { TokenCounter } from './tokenCounter.js'
import { PromptBuilder } from './promptBuilder.js'
import type { EventBus } from '../events/eventBus.js'
import { logger } from '../../utils/logger.js'

const MAX_TOOL_LOOPS = 40

export interface EngineConfig {
  provider: LLMProvider
  toolRegistry: ToolRegistry
  toolExecutor: ToolExecutor
  contextManager: ContextManager
  tokenCounter: TokenCounter
  promptBuilder: PromptBuilder
  eventBus: EventBus
  maxTokens: number
  model: string
  maxSessionCost: number
}

export class QueryEngine {
  private config: EngineConfig

  constructor(config: EngineConfig) { this.config = config }

  async run(messages: Message[], workingDir: string, onText?: (text: string) => void, sharedState?: Record<string, unknown>): Promise<RunResult> {
    const systemPrompt = await this.config.promptBuilder.build(workingDir)
    let fitted = this.config.contextManager.fitToContext(messages)

    const toolContext: ToolContext = { workingDir, sharedState: sharedState || {} }

    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
      if (this.config.tokenCounter.cost >= this.config.maxSessionCost) {
        logger.warn('Session cost limit reached', { cost: this.config.tokenCounter.cost })
        break
      }

      const { response, toolCalls, inputTokens, outputTokens } = await this.callProvider(systemPrompt, fitted, onText)
      this.config.tokenCounter.add(inputTokens, outputTokens)
      fitted.push(response)

      if (toolCalls.length === 0) break

      const results = await this.config.toolExecutor.executeAll(toolCalls, toolContext)
      const resultContent: ContentBlock[] = results.map(r => ({
        type: 'tool_result', tool_use_id: r.id, content: r.result.output, is_error: r.result.isError,
      }))
      fitted.push({ role: 'tool_result' as const, content: resultContent })

      if (toolContext.sharedState.workingDir) {
        workingDir = toolContext.sharedState.workingDir as string
        toolContext.workingDir = workingDir
      }
    }

    const lastAssistant = [...fitted].reverse().find(m => m.role === 'assistant')
    return {
      response: lastAssistant || { role: 'assistant', content: [{ type: 'text', text: '' }] },
      messages: fitted,
      inputTokens: this.config.tokenCounter.inputTokens,
      outputTokens: this.config.tokenCounter.outputTokens,
    }
  }

  private async callProvider(
    systemPrompt: string, messages: Message[], onText?: (text: string) => void,
  ): Promise<{ response: Message; toolCalls: ToolCall[]; inputTokens: number; outputTokens: number }> {
    const tools = this.config.toolRegistry.toApiSchemas()
    let textParts: string[] = []
    let toolCalls: ToolCall[] = []
    let inputTokens = 0, outputTokens = 0

    const maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      textParts = []
      toolCalls = []
      inputTokens = 0
      outputTokens = 0
      try {
        for await (const chunk of this.config.provider.stream(
          systemPrompt, messages, tools, { maxTokens: this.config.maxTokens, model: this.config.model }
        )) {
          switch (chunk.type) {
            case 'text':
              if (chunk.text) { textParts.push(chunk.text); onText?.(chunk.text); this.config.eventBus.emit('text', { text: chunk.text }) }
              break
            case 'tool_use':
              toolCalls.push({ id: chunk.id!, name: chunk.name!, input: chunk.input as Record<string, unknown> })
              break
            case 'usage':
              inputTokens = chunk.inputTokens || 0; outputTokens = chunk.outputTokens || 0
              break
          }
        }
        break
      } catch (e: any) {
        if (attempt < maxRetries - 1 && (e?.status === 429 || e?.status === 529)) {
          const delay = Math.pow(2, attempt) * 1000
          logger.warn('Rate limited, retrying', { attempt, delay })
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw e
      }
    }

    this.config.eventBus.emit('text_done', {})
    const content: ContentBlock[] = []
    if (textParts.length > 0) content.push({ type: 'text', text: textParts.join('') })
    for (const tc of toolCalls) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })

    return { response: { role: 'assistant', content }, toolCalls, inputTokens, outputTokens }
  }

  getConfigSnapshot(): EngineConfig { return { ...this.config } }
  get tokenCounter(): TokenCounter { return this.config.tokenCounter }
  get model(): string { return this.config.model }
  setModel(model: string): void { this.config.model = model; this.config.tokenCounter.setModel(model) }
}
