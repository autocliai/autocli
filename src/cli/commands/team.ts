import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'

export const teamCommand: CommandDefinition = {
  name: 'team',
  description: 'Show team status or save team as template',

  async execute(args, _context) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const sub = parts[0]

    if (sub === 'save') {
      const saveName = parts[1]
      if (!saveName) {
        return { output: theme.error('Usage: /team save <name>') }
      }

      // We can't access teamManager directly from a command,
      // so we return a special result type for the REPL to handle
      return { type: 'team_save', saveName }
    }

    // Default: show team status
    return { type: 'team_status' }
  },
}
