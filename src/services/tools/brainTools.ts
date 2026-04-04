import { z } from 'zod'
import type { ToolDefinition, ToolResult } from './types.js'
import type { BrainStore, PARACategory } from '../../stores/brainStore.js'

export function createBrainTools(brainStore: BrainStore): { brainNoteTool: ToolDefinition; brainRecallTool: ToolDefinition } {
  const brainNoteTool: ToolDefinition = {
    name: 'BrainNote',
    description: 'Save a note to the Second Brain knowledge base.',
    inputSchema: z.object({
      title: z.string(), content: z.string(),
      category: z.enum(['projects', 'areas', 'resources', 'archives']),
      tags: z.array(z.string()).optional().default([]),
    }),
    isReadOnly: false,
    async call(input: unknown): Promise<ToolResult> {
      const { title, content, category, tags = [] } = input as { title: string; content: string; category: PARACategory; tags?: string[] }
      const note = await brainStore.writeNote({ title, content, category, tags })
      return { output: `Saved note "${title}" to ${category} (id: ${note.id})` }
    },
  }

  const brainRecallTool: ToolDefinition = {
    name: 'BrainRecall',
    description: 'Search the Second Brain for relevant notes.',
    inputSchema: z.object({ query: z.string() }),
    isReadOnly: true,
    async call(input: unknown): Promise<ToolResult> {
      const { query } = input as { query: string }
      const notes = brainStore.search(query)
      if (notes.length === 0) return { output: 'No relevant notes found.' }
      return { output: notes.map(n => `## ${n.title} (${n.category})\nTags: ${n.tags.join(', ')}\n\n${n.content.slice(0, 500)}`).join('\n\n---\n\n') }
    },
  }
  return { brainNoteTool, brainRecallTool }
}
