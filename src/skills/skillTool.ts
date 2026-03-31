import { z } from 'zod'
import type { ToolDefinition } from '../tools/types.js'
import type { SkillLoader } from './loader.js'

export function createSkillTool(loader: SkillLoader): ToolDefinition {
  return {
    name: 'Skill',
    description: 'Invoke a skill by name. Skills provide specialized workflows and capabilities.',
    inputSchema: z.object({
      skill: z.string().describe('The skill name to invoke'),
      args: z.string().optional().describe('Optional arguments for the skill'),
    }),
    isReadOnly: true,

    async call(input, _context) {
      const { skill: skillName, args } = input as { skill: string; args?: string }

      const skill = loader.get(skillName)
      if (!skill) {
        const available = loader.list().map(s => s.name).join(', ')
        return {
          output: `Skill "${skillName}" not found. Available skills: ${available || 'none'}`,
          isError: true,
        }
      }

      let content = skill.content
      if (args) {
        content = `Arguments: ${args}\n\n${content}`
      }

      return {
        output: `# Skill: ${skill.name}\n\n${content}`,
      }
    },
  }
}
