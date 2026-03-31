import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'

export const costCommand: CommandDefinition = {
  name: 'cost',
  description: 'Show token usage and cost for this session',

  async run(_args, context) {
    return [
      theme.bold('Session usage:'),
      `  Input tokens:  ${context.totalTokens.input.toLocaleString()}`,
      `  Output tokens: ${context.totalTokens.output.toLocaleString()}`,
      `  Total cost:    $${context.totalCost.toFixed(4)}`,
      `  Messages:      ${context.messages.length}`,
    ].join('\n')
  },
}
