import type { CommandDefinition, CommandResult } from './types.js'

export const reviewCommand: CommandDefinition = {
  name: 'review',
  description: 'Review code changes (staged or unstaged)',
  aliases: ['cr'],

  async run(args, _context): Promise<CommandResult> {
    const target = args[0] || ''
    let prompt: string

    if (target.match(/^\d+$/)) {
      // PR number
      prompt = `Review pull request #${target}. Use Bash to run: git log --oneline main..HEAD, git diff main...HEAD. Analyze the changes for bugs, security issues, code quality, and suggest improvements.`
    } else if (target === '--staged' || target === '-s') {
      prompt = `Review the staged git changes. Run: git diff --cached. Analyze for bugs, security issues, code quality, and suggest improvements.`
    } else {
      prompt = `Review the current git changes. Run: git diff and git status. Analyze all modified files for bugs, security issues, code quality, and suggest improvements. Be thorough but concise.`
    }

    return { type: 'prompt', prompt }
  },
}
