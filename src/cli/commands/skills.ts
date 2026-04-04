import type { CommandDefinition } from './types.js'
import { theme } from '../ui/theme.js'
import { SkillLoader } from '../../services/skills/loader.js'
import { platform } from '../../utils/platform.js'
import { join } from 'path'

export const skillsCommand: CommandDefinition = {
  name: 'skills',
  description: 'List available skills',

  async execute(_args, _context) {
    const loader = new SkillLoader([
      join(platform.configDir, 'skills'),
    ])
    const skills = loader.list()
    if (skills.length === 0) {
      return {
        output: [
          'No skills installed.',
          '',
          theme.dim(`Add skills to ${join(platform.configDir, 'skills')}/ as .md files with frontmatter.`),
        ].join('\n'),
      }
    }
    return {
      output: [
        theme.bold('Available skills:'),
        '',
        ...skills.map(s => `  ${theme.tool(s.name)} — ${s.description}`),
        '',
        theme.dim('Invoke with: /skill-name or via the Skill tool'),
      ].join('\n'),
    }
  },
}
