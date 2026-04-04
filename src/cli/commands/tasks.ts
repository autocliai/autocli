import type { CommandDefinition } from './types.js'

export const tasksCommand: CommandDefinition = {
  name: 'tasks',
  description: 'List background tasks and their status',

  async execute(_args, _context) {
    return { type: 'list_bg_tasks' }
  },
}
