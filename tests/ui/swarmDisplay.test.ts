import { describe, expect, test } from 'bun:test'
import { renderSwarmStatus, renderAgentTree } from '../../src/ui/swarmDisplay.js'
import type { AgentStatus } from '../../src/ui/swarmDisplay.js'

describe('swarmDisplay', () => {
  const agents: AgentStatus[] = [
    { id: '1', name: 'Agent-1', type: 'coder', status: 'running', toolCount: 5, tokenCount: 1000, elapsed: 10 },
    { id: '2', name: 'Agent-2', type: 'reviewer', status: 'completed', toolCount: 3, tokenCount: 500, elapsed: 5 },
    { id: '3', name: 'Agent-3', type: 'tester', status: 'failed', toolCount: 1, tokenCount: 200, elapsed: 2 },
  ]

  test('renderSwarmStatus returns message for empty agents', () => {
    const result = renderSwarmStatus([])
    expect(result).toContain('No active agents')
  })

  test('renderSwarmStatus renders all agents', () => {
    const result = renderSwarmStatus(agents)
    expect(result).toContain('Agent-1')
    expect(result).toContain('Agent-2')
    expect(result).toContain('Agent-3')
    expect(result).toContain('coder')
    expect(result).toContain('reviewer')
  })

  test('renderAgentTree returns empty for no agents', () => {
    expect(renderAgentTree([])).toBe('')
  })

  test('renderAgentTree shows tree structure', () => {
    const result = renderAgentTree(agents)
    expect(result).toContain('├─')
    expect(result).toContain('└─')
    expect(result).toContain('Agent-1')
    expect(result).toContain('Agent-3')
  })
})
