import type { LLMProvider } from '../providers/types.js'
import { logger } from '../../utils/logger.js'

const SAFETY_PROMPT = `You are a safety evaluator. Decide if a tool call is safe.

ALLOW if: Reading files, searching code, running non-destructive commands, writing/editing project files, running tests.
DENY if: Deleting files outside project, rm -rf, force push, exfiltrating data, modifying system files.

Respond with exactly "ALLOW" or "DENY" followed by a brief reason.`

export async function llmConfirmTool(provider: LLMProvider, toolName: string, input: Record<string, unknown>): Promise<boolean> {
  const prompt = `Tool: ${toolName}\nInput: ${JSON.stringify(input, null, 2)}`
  try {
    let response = ''
    for await (const chunk of provider.stream(
      SAFETY_PROMPT, [{ role: 'user', content: [{ type: 'text', text: prompt }] }], [], { maxTokens: 100 }
    )) {
      if (chunk.type === 'text' && chunk.text) response += chunk.text
    }
    const allowed = response.trim().toUpperCase().startsWith('ALLOW')
    logger.info('LLM confirm', { toolName, allowed, response: response.slice(0, 100) })
    return allowed
  } catch (e) {
    logger.error('LLM confirm failed, denying', { error: String(e) })
    return false
  }
}
