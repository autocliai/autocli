import { z } from 'zod'
import type { ToolDefinition } from '../tools/types.js'
import type { TaskStore } from './taskStore.js'

export function createTaskTools(store: TaskStore) {
  const create: ToolDefinition = {
    name: 'TaskCreate',
    description: 'Create a task to track work progress.',
    inputSchema: z.object({
      subject: z.string().describe('Brief task title'),
      description: z.string().describe('What needs to be done'),
      activeForm: z.string().optional().describe('Present continuous form for spinner'),
      metadata: z.record(z.unknown()).optional(),
    }),
    isReadOnly: false,
    async call(input, _context) {
      const { subject, description, activeForm, metadata } = input as {
        subject: string; description: string; activeForm?: string; metadata?: Record<string, unknown>
      }
      const task = store.create(subject, description, { activeForm, metadata })
      return { output: `Task #${task.id} created: ${task.subject}` }
    },
  }

  const update: ToolDefinition = {
    name: 'TaskUpdate',
    description: 'Update a task status or details.',
    inputSchema: z.object({
      taskId: z.string().describe('The task ID to update'),
      status: z.enum(['pending', 'in_progress', 'completed', 'deleted']).optional(),
      subject: z.string().optional(),
      description: z.string().optional(),
      activeForm: z.string().optional(),
      owner: z.string().optional(),
      addBlocks: z.array(z.string()).optional(),
      addBlockedBy: z.array(z.string()).optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
    isReadOnly: false,
    async call(input, _context) {
      const { taskId, status, addBlocks, addBlockedBy, ...fields } = input as {
        taskId: string; status?: string; addBlocks?: string[]; addBlockedBy?: string[];
        subject?: string; description?: string; activeForm?: string; owner?: string;
        metadata?: Record<string, unknown>
      }

      if (status === 'deleted') {
        const deleted = store.delete(taskId)
        return deleted
          ? { output: `Task #${taskId} deleted.` }
          : { output: `Task #${taskId} not found.`, isError: true }
      }

      const updateFields: Record<string, unknown> = { ...fields }
      if (status) updateFields.status = status

      const task = store.update(taskId, updateFields)
      if (!task) return { output: `Task #${taskId} not found.`, isError: true }

      if (addBlocks) for (const id of addBlocks) store.addBlock(taskId, id)
      if (addBlockedBy) for (const id of addBlockedBy) store.addBlock(id, taskId)

      return { output: `Updated task #${taskId}: ${task.subject} [${task.status}]` }
    },
  }

  const list: ToolDefinition = {
    name: 'TaskList',
    description: 'List all tasks with their status.',
    inputSchema: z.object({}),
    isReadOnly: true,
    async call(_input, _context) {
      const tasks = store.list()
      if (tasks.length === 0) return { output: 'No tasks.' }

      const lines = tasks.map(t => {
        const status = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '○'
        const owner = t.owner ? ` (${t.owner})` : ''
        const blocked = t.blockedBy.filter(id => {
          const b = store.get(id)
          return b && b.status !== 'completed'
        })
        const blockedStr = blocked.length > 0 ? ` [blocked by: ${blocked.join(', ')}]` : ''
        return `${status} #${t.id}: ${t.subject}${owner}${blockedStr}`
      })
      return { output: lines.join('\n') }
    },
  }

  const get: ToolDefinition = {
    name: 'TaskGet',
    description: 'Get details of a specific task.',
    inputSchema: z.object({
      taskId: z.string().describe('The task ID'),
    }),
    isReadOnly: true,
    async call(input, _context) {
      const { taskId } = input as { taskId: string }
      const task = store.get(taskId)
      if (!task) return { output: `Task #${taskId} not found.`, isError: true }

      return {
        output: [
          `# Task #${task.id}: ${task.subject}`,
          `Status: ${task.status}`,
          task.owner ? `Owner: ${task.owner}` : '',
          `Description: ${task.description}`,
          task.blocks.length ? `Blocks: ${task.blocks.join(', ')}` : '',
          task.blockedBy.length ? `Blocked by: ${task.blockedBy.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
      }
    },
  }

  return { create, update, list, get }
}
