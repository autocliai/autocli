import { z } from 'zod'
import type { ToolDefinition } from '../tools/types.js'
import type { SkillLoader } from './loader.js'

async function executeShellBlocks(content: string, cwd: string): Promise<string> {
  // Handle ```! code blocks
  content = await replaceAsync(content, /```!\s*\n([\s\S]*?)```/g, async (_, cmd) => {
    const result = await runShell(cmd.trim(), cwd)
    return '```\n' + result + '\n```'
  })

  // Handle inline !`cmd`
  content = await replaceAsync(content, /!`([^`]+)`/g, async (_, cmd) => {
    return await runShell(cmd.trim(), cwd)
  })

  return content
}

const SHELL_DENY = [
  /\brm\s+-[a-zA-Z]*f/,
  /\bmkfs\b/,
  /\bdd\s+of=/,
  /:\(\)\s*\{/,                    // fork bomb
  /\|\s*(?:bash|sh|zsh)\b/,       // pipe to shell
]

async function runShell(cmd: string, cwd: string): Promise<string> {
  if (SHELL_DENY.some(p => p.test(cmd))) {
    return `[Blocked: dangerous command in skill: ${cmd.slice(0, 60)}]`
  }
  const proc = Bun.spawn(['bash', '-c', cmd], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const timeout = setTimeout(() => { try { proc.kill('SIGTERM') } catch {} }, 15_000)
  const stdout = await new Response(proc.stdout).text()
  clearTimeout(timeout)
  await proc.exited
  return stdout.trim()
}

async function replaceAsync(str: string, regex: RegExp, fn: (match: string, ...args: string[]) => Promise<string>): Promise<string> {
  const matches: Array<{ match: string; index: number; length: number; groups: string[] }> = []
  let m: RegExpExecArray | null
  const r = new RegExp(regex.source, regex.flags)
  while ((m = r.exec(str)) !== null) {
    matches.push({ match: m[0], index: m.index, length: m[0].length, groups: m.slice(1) })
  }
  let result = str
  // Process from end to start to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const { match, index, length, groups } = matches[i]
    const replacement = await fn(match, ...groups)
    result = result.slice(0, index) + replacement + result.slice(index + length)
  }
  return result
}

export function createSkillTool(loader: SkillLoader): ToolDefinition {
  return {
    name: 'Skill',
    description: 'Invoke a skill by name. Skills provide specialized workflows and capabilities.',
    inputSchema: z.object({
      skill: z.string().describe('The skill name to invoke'),
      args: z.string().optional().describe('Optional arguments for the skill'),
    }),
    isReadOnly: true,

    async call(input, context) {
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

      // Execute shell blocks
      content = await executeShellBlocks(content, context.workingDir)

      // Variable substitution
      if (skill.filePath) {
        const skillDir = skill.filePath.replace(/\/[^/]+$/, '')
        content = content.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)
      }
      if (args) {
        content = content.replace(/\{\{\s*args?\s*\}\}/g, args)
      }

      if (args) {
        content = `Arguments: ${args}\n\n${content}`
      }

      // Enforce tool restrictions by storing in sharedState for the engine to check
      if (skill.allowedTools && context.sharedState) {
        context.sharedState.skillAllowedTools = skill.allowedTools
      }

      const toolNote = skill.allowedTools
        ? `\n\n[This skill restricts tools to: ${skill.allowedTools.join(', ')}. Other tools will be blocked until the skill completes.]`
        : ''

      return {
        output: `# Skill: ${skill.name}\n\n${content}${toolNote}`,
      }
    },
  }
}
