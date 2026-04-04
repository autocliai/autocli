import type { LLMProvider, Message } from '../providers/types.js'
import type { MemoryStore, MemoryType } from '../../stores/memoryStore.js'
import { logger } from '../../utils/logger.js'

const EXTRACTION_PROMPT = `Analyze the conversation and extract any information worth remembering for future sessions.

Types:
- user: Info about the user (role, preferences, expertise)
- feedback: Guidance on how to work (corrections, confirmations)
- project: Info about ongoing work, goals, deadlines
- reference: Pointers to external resources

Return JSON array (or empty array if nothing to extract):
[{"name": "slug-name", "description": "one-line description", "type": "user|feedback|project|reference", "content": "the memory content"}]

Only extract information useful in FUTURE conversations. Skip ephemeral task details.`

export async function extractMemories(
  messages: Message[], provider: LLMProvider, memoryStore: MemoryStore, existingNames: string[],
): Promise<void> {
  const recent = messages.slice(-10)
  const conversationText = recent.map(m => {
    const text = m.content.filter(b => b.type === 'text').map(b => b.text).join('')
    return `${m.role}: ${text}`
  }).join('\n')

  const prompt = `${EXTRACTION_PROMPT}\n\nExisting memories (avoid duplicates): ${existingNames.join(', ')}\n\nConversation:\n${conversationText}`

  try {
    let response = ''
    for await (const chunk of provider.stream(
      'You extract memories from conversations. Return only valid JSON.',
      [{ role: 'user', content: [{ type: 'text', text: prompt }] }], [], { maxTokens: 1000 }
    )) { if (chunk.type === 'text' && chunk.text) response += chunk.text }

    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return
    const memories = JSON.parse(jsonMatch[0]) as Array<{ name: string; description: string; type: MemoryType; content: string }>
    for (const mem of memories) {
      if (!mem.name || !mem.content || existingNames.includes(mem.name)) continue
      await memoryStore.save(mem)
      logger.info('Auto-extracted memory', { name: mem.name, type: mem.type })
    }
  } catch (e) { logger.debug('Memory extraction failed', { error: String(e) }) }
}
