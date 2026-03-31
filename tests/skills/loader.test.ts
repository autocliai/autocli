import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { SkillLoader } from '../../src/skills/loader.js'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-skills'

beforeAll(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, 'test-skill.md'), `---
name: test-skill
description: A test skill
---

Do the thing.
`)
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('SkillLoader', () => {
  test('loads skills from directory', () => {
    const loader = new SkillLoader([TMP])
    const skills = loader.list()
    expect(skills.length).toBeGreaterThanOrEqual(1)
    expect(skills[0].name).toBe('test-skill')
  })

  test('gets skill by name', () => {
    const loader = new SkillLoader([TMP])
    const skill = loader.get('test-skill')
    expect(skill).toBeDefined()
    expect(skill!.content).toContain('Do the thing')
  })

  test('returns undefined for unknown skill', () => {
    const loader = new SkillLoader([TMP])
    expect(loader.get('nonexistent')).toBeUndefined()
  })
})
