import type { LLMProvider, StreamChunk, Message, ToolSchema } from './types.js'
import { logger } from '../../utils/logger.js'

interface ClaudeLocalConfig { command: string; args: string[]; model: string }

export class ClaudeLocalBridge implements LLMProvider {
  name = 'claude-local'
  private config: ClaudeLocalConfig
  constructor(config: ClaudeLocalConfig) { this.config = config }

  async *stream(
    systemPrompt: string, messages: Message[], _tools: ToolSchema[],
    options?: { maxTokens?: number; model?: string },
  ): AsyncIterable<StreamChunk> {
    const model = options?.model || this.config.model
    const lastUser = messages.filter(m => m.role === 'user').pop()
    const prompt = lastUser?.content.filter(b => b.type === 'text').map(b => b.text).join('') || ''

    const args = [
      ...this.config.args,
      '--model', model,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--print',
      prompt,
    ]

    if (systemPrompt) {
      args.push('--append-system-prompt', systemPrompt)
    }

    logger.debug('ClaudeLocal stream', { command: this.config.command, model })

    const proc = Bun.spawn([this.config.command, ...args], {
      stdout: 'pipe', stderr: 'pipe',
    })

    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0
    let yieldedText = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)

            if (event.type === 'assistant' && event.message?.content) {
              // Full assistant message — extract text from content blocks
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  yield { type: 'text', text: block.text }
                  yieldedText = true
                }
              }
              // Extract usage from the message
              if (event.message.usage) {
                inputTokens = event.message.usage.input_tokens || 0
                outputTokens = event.message.usage.output_tokens || 0
              }
            } else if (event.type === 'content_block_delta' && event.delta?.text) {
              yield { type: 'text', text: event.delta.text }
              yieldedText = true
            } else if (event.type === 'result') {
              // Final result — use it if we haven't yielded text yet
              if (!yieldedText && event.result) {
                yield { type: 'text', text: event.result }
              }
              if (event.usage) {
                inputTokens = event.usage.input_tokens || 0
                outputTokens = event.usage.output_tokens || 0
              }
              if (event.modelUsage) {
                // Extract from per-model usage breakdown
                for (const usage of Object.values(event.modelUsage) as any[]) {
                  inputTokens = usage.inputTokens || inputTokens
                  outputTokens = usage.outputTokens || outputTokens
                }
              }
            }
            // Ignore system, rate_limit_event, message_delta, etc.
          } catch {
            // Non-JSON line — skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Read stderr concurrently to prevent pipe buffer deadlock
    const stderrPromise = new Response(proc.stderr).text()
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      const stderr = await stderrPromise
      logger.error('ClaudeLocal failed', { exitCode, stderr })
      if (!yieldedText) {
        yield { type: 'text', text: `Error: Claude CLI exited with code ${exitCode}: ${stderr.slice(0, 500)}` }
      }
    }

    if (inputTokens > 0 || outputTokens > 0) {
      yield { type: 'usage', inputTokens, outputTokens }
    }
    yield { type: 'done' }
  }
}
