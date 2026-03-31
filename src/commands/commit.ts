import type { CommandDefinition } from './types.js'

export const commitCommand: CommandDefinition = {
  name: 'commit',
  description: 'Create a git commit (sends prompt to LLM to generate commit message)',

  async run(_args, _context) {
    return '__PROMPT__:Look at the git status and diff, then create an appropriate commit. Follow conventional commit format. Ask the user to confirm before committing.'
  },
}
