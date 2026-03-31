import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'

export const helpCommand: CommandDefinition = {
  name: 'help',
  description: 'Show available commands',
  aliases: ['h', '?'],

  async run(_args, _context) {
    return [
      theme.bold('Available commands:'),
      '',
      '  /help        Show this help',
      '  /cost        Show token usage and cost',
      '  /diff        Show git diff',
      '  /commit      Create a git commit',
      '  /compact     Compact conversation context',
      '',
      theme.dim('Type a message to chat, or /command to run a command.'),
    ].join('\n')
  },
}
