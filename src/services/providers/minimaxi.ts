import { OpenAIProvider } from './openai.js'
import type { LLMProvider, StreamChunk, Message, ToolSchema } from './types.js'

interface MinimaXIConfig { apiKey: string; baseUrl: string; model: string }

export class MinimaXIProvider implements LLMProvider {
  name = 'minimaxi-cn'
  private inner: OpenAIProvider

  constructor(config: MinimaXIConfig) {
    this.inner = new OpenAIProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model })
  }

  async *stream(systemPrompt: string, messages: Message[], tools: ToolSchema[], options?: { maxTokens?: number; model?: string }): AsyncIterable<StreamChunk> {
    const adapted = this.transformPrompt(systemPrompt)
    const adaptedTools = this.transformToolSchemas(tools)
    yield* this.inner.stream(adapted, messages, adaptedTools, options)
  }

  transformPrompt(systemPrompt: string): string {
    const lines = systemPrompt.split('\n')
    return lines.filter(l => {
      const trimmed = l.trim()
      if (trimmed === '') return false  // drop blank lines
      return true  // keep all non-empty lines
    }).join('\n')
  }

  transformToolSchemas(tools: ToolSchema[]): ToolSchema[] {
    return tools.map(t => ({ ...t, description: (t.description || '').split('\n')[0] }))
  }
}
