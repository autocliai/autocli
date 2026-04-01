// Provider types used by the OpenAI adapter and future provider implementations
export interface ProviderMessage {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >
  usage: { input_tokens: number; output_tokens: number }
}

export interface ProviderConfig {
  provider: 'anthropic' | 'openai' | 'claude-local' | 'minimaxi-cn'
  apiKey: string
  baseUrl?: string
  model: string
}
