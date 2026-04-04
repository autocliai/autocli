import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../tools/types.js'
import type { SkillLoader } from './loader.js'

export function createSkillTool(skillLoader: SkillLoader): ToolDefinition {
  return {
    name: 'Skill',
    description: 'Execute a loaded skill by name.',
    inputSchema: z.object({ name: z.string(), args: z.string().optional() }),
    isReadOnly: true,
    async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
      const { name, args } = input as { name: string; args?: string }
      const skill = skillLoader.get(name)
      if (!skill) return { output: `Skill not found: ${name}. Available: ${skillLoader.list().map(s => s.name).join(', ')}`, isError: true }
      if (skill.allowedTools) ctx.sharedState.skillAllowedTools = skill.allowedTools
      let content = skill.content
      if (args) content = content.replace(/\$ARGS/g, args)
      // skillAllowedTools is cleaned up by ToolExecutor after the skill's tool calls complete
      return { output: content }
    },
  }
}
