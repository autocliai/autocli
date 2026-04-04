const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  'miniMax-2.7': { input: 1, output: 3 },
}

export class TokenCounter {
  private model: string
  inputTokens = 0
  outputTokens = 0
  private accumulatedCost = 0

  constructor(model: string) { this.model = model }

  add(input: number, output: number): void {
    this.inputTokens += input
    this.outputTokens += output
    // Accumulate cost using current model pricing at time of usage
    const pricing = PRICING[this.model] || { input: 3, output: 15 }
    this.accumulatedCost += (input * pricing.input + output * pricing.output) / 1_000_000
  }

  get cost(): number { return this.accumulatedCost }

  format(): string { return `↑${this.formatTokens(this.inputTokens)} ↓${this.formatTokens(this.outputTokens)} $${this.cost.toFixed(4)}` }
  setModel(model: string): void { this.model = model }

  private formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }
}
