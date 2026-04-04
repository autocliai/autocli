import type { CommandDefinition } from './types.js'

export const reviewCommand: CommandDefinition = {
  name: 'review',
  description: 'Review code changes (staged or unstaged)',
  aliases: ['cr'],

  async execute(args, _context) {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const target = parts[0] || ''
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
