import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { createSkillTool } from '../../src/skills/skillTool.js'
import { SkillLoader } from '../../src/skills/loader.js'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-skill-tool'

beforeAll(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, 'greet.md'), `---
name: greet
description: Greet the user
---

Say hello to the user in a friendly way.
`)
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('createSkillTool', () => {
  test('creates a valid tool definition', () => {
    const loader = new SkillLoader([TMP])
    const tool = createSkillTool(loader)
    expect(tool.name).toBe('Skill')
    expect(tool.isReadOnly).toBe(true)
  })

  test('call returns skill content for valid skill', async () => {
    const loader = new SkillLoader([TMP])
    const tool = createSkillTool(loader)
    const result = await tool.call({ skill: 'greet' }, { workingDir: '/tmp' })
    expect(result.output).toContain('Say hello')
    expect(result.isError).toBeFalsy()
  })

  test('call returns error for unknown skill', async () => {
    const loader = new SkillLoader([TMP])
    const tool = createSkillTool(loader)
    const result = await tool.call({ skill: 'nonexistent' }, { workingDir: '/tmp' })
    expect(result.isError).toBe(true)
    expect(result.output).toContain('not found')
  })
})
