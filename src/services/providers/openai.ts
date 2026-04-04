import type { LLMProvider, StreamChunk, Message, ToolSchema } from './types.js'
import { logger } from '../../utils/logger.js'

interface OpenAIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai'
  private config: OpenAIConfig

  constructor(config: OpenAIConfig) { this.config = config }

  async *stream(systemPrompt: string, messages: Message[], tools: ToolSchema[], options?: { maxTokens?: number; model?: string }): AsyncIterable<StreamChunk> {
    const model = options?.model || this.config.model
    const maxTokens = options?.maxTokens || 8192

    const openaiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.flatMap(m => this.toOpenAI(m)),
    ]

    const openaiTools = tools.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))

    const body: Record<string, unknown> = { model, messages: openaiMessages, max_tokens: maxTokens, stream: true }
    if (openaiTools.length > 0) body.tools = openaiTools

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error('OpenAI API error', { status: response.status, body: text })
      if (response.status === 429 || response.status === 529) {
        const err = new Error(`OpenAI API rate limited (${response.status}): ${text}`) as any
        err.status = response.status
        throw err
      }
      throw new Error(`OpenAI API error ${response.status}: ${text}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    const toolCalls = new Map<number, { id: string; name: string; args: string }>()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]
            if (!choice) continue
            const delta = choice.delta
            if (delta?.content) yield { type: 'text', text: delta.content }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (tc.id) {
                  const existing = toolCalls.get(idx)
                  toolCalls.set(idx, { id: tc.id, name: tc.function?.name || existing?.name || '', args: existing?.args || '' })
                }
                const entry = toolCalls.get(idx)
                if (entry) {
                  if (tc.function?.name && !entry.name) entry.name = tc.function.name
                  if (tc.function?.arguments) entry.args += tc.function.arguments
                }
              }
            }
            if (parsed.usage) {
              yield { type: 'usage', inputTokens: parsed.usage.prompt_tokens || 0, outputTokens: parsed.usage.completion_tokens || 0 }
            }
          } catch (e) {
            logger.warn('Failed to parse SSE chunk', { error: String(e), data })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    for (const [, tc] of toolCalls) {
      if (!tc.name) continue
      let input: unknown = {}
      try { input = JSON.parse(tc.args) } catch (e) {
        logger.warn('Failed to parse tool call arguments', { name: tc.name, error: String(e), args: tc.args.slice(0, 200) })
      }
      yield { type: 'tool_use', id: tc.id, name: tc.name, input }
    }
    yield { type: 'done' }
  }

  private toOpenAI(msg: Message): Record<string, unknown>[] {
    if (msg.role === 'tool_result') {
      return msg.content.filter(b => b.tool_use_id).map(b => ({
        role: 'tool', tool_call_id: b.tool_use_id, content: b.content || b.text || '',
      }))
    }

    const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const toolUseParts = msg.content.filter(b => b.type === 'tool_use')

    if (toolUseParts.length > 0) {
      return [{
        role: 'assistant', content: textParts || null,
        tool_calls: toolUseParts.map(t => ({
          id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.input) },
        })),
      }]
    }
    return [{ role: msg.role, content: textParts }]
  }
}
