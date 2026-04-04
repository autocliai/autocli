import { describe, test, expect } from 'bun:test'
import { skillsCommand } from '../../src/cli/commands/skills.js'
import { makeContext } from './helpers.js'

describe('skills command', () => {
  test('returns output listing skills or empty message', async () => {
    const result = await skillsCommand.execute('', makeContext())
    expect(result.output).toBeDefined()
    // Either shows "No skills installed" or a list
    const hasSkills = result.output!.includes('Available skills')
    const noSkills = result.output!.includes('No skills installed')
    expect(hasSkills || noSkills).toBe(true)
  })

  test('has correct name', () => {
    expect(skillsCommand.name).toBe('skills')
  })
})
