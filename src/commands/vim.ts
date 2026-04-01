import type { CommandDefinition, CommandResult } from './types.js'

export const vimCommand: CommandDefinition = {
  name: 'vim',
  description: 'Toggle vim keybinding mode',

  async run(_args, _context): Promise<CommandResult> {
    return { type: 'vim_toggle' } as CommandResult
  },
}
