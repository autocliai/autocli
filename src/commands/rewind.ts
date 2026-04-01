import type { CommandDefinition, CommandResult } from './types.js'

export const rewindCommand: CommandDefinition = {
  name: 'rewind',
  description: 'Undo last N conversation turns (default: 1)',
  aliases: ['undo'],

  async run(args, _context): Promise<CommandResult> {
    const n = parseInt(args[0] || '1', 10) || 1
    return { type: 'rewind', turns: n } as any
  },
}
