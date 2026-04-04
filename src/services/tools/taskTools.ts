import { z } from 'zod'
import type { ToolDefinition, ToolResult } from './types.js'
import type { TaskStore } from '../../stores/taskStore.js'

export function createTaskTools(taskStore: TaskStore): ToolDefinition[] {
  const taskCreate: ToolDefinition = {
    name: 'TaskCreate', description: 'Create a new task.',
    inputSchema: z.object({ subject: z.string(), description: z.string().optional(), activeForm: z.string().optional() }),
    isReadOnly: false,
    async call(input: unknown): Promise<ToolResult> {
      const { subject, description, activeForm } = input as { subject: string; description?: string; activeForm?: string }
      const task = taskStore.create({ subject, description, activeForm })
      return { output: `Task #${task.id} created: ${subject}` }
    },
  }
  const taskUpdate: ToolDefinition = {
    name: 'TaskUpdate', description: 'Update a task status or fields.',
    inputSchema: z.object({ taskId: z.string(), status: z.enum(['pending', 'in_progress', 'completed', 'deleted']).optional(), subject: z.string().optional(), description: z.string().optional(), owner: z.string().optional() }),
    isReadOnly: false,
    async call(input: unknown): Promise<ToolResult> {
      const { taskId, status, ...fields } = input as { taskId: string; status?: string; [k: string]: unknown }
      const id = parseInt(taskId)
      if (isNaN(id)) return { output: `Invalid task ID: ${taskId}`, isError: true }
      if (status === 'deleted') { taskStore.delete(id); return { output: `Task #${id} deleted` } }
      const updateFields: Record<string, unknown> = { ...fields }
      if (status !== undefined) updateFields.status = status
      taskStore.update(id, updateFields as any)
      return { output: `Task #${id} updated` }
    },
  }
  const taskList: ToolDefinition = {
    name: 'TaskList', description: 'List all tasks.',
    inputSchema: z.object({}), isReadOnly: true,
    async call(): Promise<ToolResult> {
      const tasks = taskStore.list()
      if (tasks.length === 0) return { output: 'No tasks.' }
      return { output: tasks.map(t => `#${t.id} [${t.status}] ${t.subject}${t.owner ? ` (${t.owner})` : ''}${t.blockedBy.length ? ` blocked by: ${t.blockedBy.join(',')}` : ''}`).join('\n') }
    },
  }
  const taskGet: ToolDefinition = {
    name: 'TaskGet', description: 'Get details of a specific task.',
    inputSchema: z.object({ taskId: z.string() }), isReadOnly: true,
    async call(input: unknown): Promise<ToolResult> {
      const { taskId } = input as { taskId: string }
      const task = taskStore.get(parseInt(taskId))
      if (!task) return { output: `Task #${taskId} not found`, isError: true }
      return { output: `#${task.id} [${task.status}] ${task.subject}\n${task.description || ''}\nOwner: ${task.owner || 'none'}\nBlocks: ${task.blocks.join(',') || 'none'}\nBlocked by: ${task.blockedBy.join(',') || 'none'}` }
    },
  }
  return [taskCreate, taskUpdate, taskList, taskGet]
}
