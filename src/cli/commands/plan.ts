import type { CommandDefinition } from './types.js'

export const planCommand: CommandDefinition = {
  name: 'plan',
  description: 'Toggle plan mode (read-only — disables Write, Edit, Bash)',

  async execute(_args, _context) {
    return { type: 'plan_toggle' }
  },
}
