import type { CommandDefinition, CommandResult } from './types.js'

export const clearCommand: CommandDefinition = {
  name: 'clear',
  description: 'Clear conversation history and start fresh',
  aliases: ['reset', 'new'],
  async run(_args, _context): Promise<CommandResult> {
    return { type: 'clear' }
  },
}
