import type { CommandDefinition } from './types.js'
import { Git } from '../git/git.js'
import { formatDiff } from '../ui/diff.js'

export const diffCommand: CommandDefinition = {
  name: 'diff',
  description: 'Show git diff',
  aliases: ['d'],

  async run(args, context) {
    const git = new Git(context.workingDir)
    if (!await git.isRepo()) return 'Not a git repository.'

    const staged = args.includes('--staged') || args.includes('-s')
    const diff = await git.diff(staged)
    return formatDiff(diff)
  },
}
