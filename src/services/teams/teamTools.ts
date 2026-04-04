import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../tools/types.js'
import type { TeamManager } from './teamManager.js'
import type { AgentStore } from '../../stores/agentStore.js'

export function createTeamTools(teamManager: TeamManager, agentStore: AgentStore): ToolDefinition[] {
  const teamCreate: ToolDefinition = {
    name: 'TeamCreate', description: 'Create a team of parallel workers.',
    inputSchema: z.object({
      name: z.string(), goal: z.string(),
      workers: z.array(z.object({ name: z.string(), agentName: z.string(), task: z.string() })),
    }),
    isReadOnly: false,
    async call(input: unknown, ctx: ToolContext): Promise<ToolResult> {
      const { name, goal, workers } = input as { name: string; goal: string; workers: { name: string; agentName: string; task: string }[] }
      const team = teamManager.create(name, goal, workers)
      const runSubAgent = ctx.sharedState.runSubAgent as any
      if (runSubAgent) {
        for (const worker of workers) {
          teamManager.updateWorker(name, worker.name, { status: 'running', startedAt: new Date().toISOString() })
          const agent = await agentStore.load(worker.agentName)
          const prompt = agent?.instructions ? `${agent.instructions}\n\nTask: ${worker.task}` : worker.task
          runSubAgent(prompt, { model: agent?.model, provider: agent?.provider, background: true })
            .then((result: string) => { try { teamManager.updateWorker(name, worker.name, { status: 'completed', result, completedAt: new Date().toISOString() }) } catch {} })
            .catch((error: Error) => { try { teamManager.updateWorker(name, worker.name, { status: 'failed', error: error.message, completedAt: new Date().toISOString() }) } catch {} })
        }
      }
      return { output: `Team "${name}" created with ${workers.length} workers` }
    },
  }

  const teamStatus: ToolDefinition = {
    name: 'TeamStatus', description: 'Get team status.',
    inputSchema: z.object({ name: z.string() }), isReadOnly: true,
    async call(input: unknown): Promise<ToolResult> {
      const { name } = input as { name: string }
      const team = teamManager.get(name)
      if (!team) return { output: `Team "${name}" not found`, isError: true }
      const lines = [`Team: ${team.name}`, `Goal: ${team.goal}`, '', 'Workers:',
        ...team.workers.map(w => `  ${w.name} [${w.status}] - ${w.task.slice(0, 50)}`)]
      return { output: lines.join('\n') }
    },
  }
  return [teamCreate, teamStatus]
}
