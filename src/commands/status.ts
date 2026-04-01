import type { CommandDefinition, CommandResult } from './types.js'

export const statusCommand: CommandDefinition = {
  name: 'status',
  description: 'Show running teams, background agents, tasks, and schedules',

  async run(_args, _context): Promise<CommandResult> {
    // Rendering needs access to teamManager, bgTaskManager, backgroundManager,
    // scheduleStore — all live in the REPL scope, so we return a signal
    return { type: 'full_status' }
  },
}
