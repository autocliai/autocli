import type { CommandDefinition } from './types.js'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { theme } from '../ui/theme.js'

export const initCommand: CommandDefinition = {
  name: 'init',
  description: 'Initialize .claude/ directory and CLAUDE.md for this project',

  async run(_args, context) {
    const claudeDir = join(context.workingDir, '.claude')
    const claudeMd = join(context.workingDir, 'CLAUDE.md')
    const created: string[] = []

    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true })
      mkdirSync(join(claudeDir, 'skills'), { recursive: true })
      created.push('.claude/', '.claude/skills/')
    }

    if (!existsSync(claudeMd)) {
      writeFileSync(claudeMd, `# Project Instructions

<!-- Add project-specific instructions for the AI assistant here. -->
<!-- These will be loaded into the system prompt automatically. -->

## Code Style
-

## Testing
-

## Architecture
-
`)
      created.push('CLAUDE.md')
    }

    if (!existsSync(join(claudeDir, 'CLAUDE.md'))) {
      writeFileSync(join(claudeDir, 'CLAUDE.md'), `# Claude Configuration

<!-- Project-level Claude configuration. -->
`)
      created.push('.claude/CLAUDE.md')
    }

    if (created.length === 0) {
      return 'Already initialized — CLAUDE.md and .claude/ exist.'
    }

    return [
      theme.success('Initialized:'),
      ...created.map(f => `  ${theme.dim('+')} ${f}`),
      '',
      theme.dim('Edit CLAUDE.md to add project-specific instructions.'),
    ].join('\n')
  },
}
