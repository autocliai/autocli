import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SkillLoader } from './loader.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-skills-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeSkillFile(dir: string, filename: string, content: string): void {
  writeFileSync(join(dir, filename), content)
}

describe('SkillLoader', () => {
  it('loads skills from directory', () => {
    writeSkillFile(tmpDir, 'test.md', '---\nname: test-skill\ndescription: A test skill\nallowed-tools: Read, Write\n---\n\nSkill content here')

    const loader = new SkillLoader([tmpDir])
    const list = loader.list()
    expect(list.length).toBe(1)
    expect(list[0].name).toBe('test-skill')
  })

  it('get(name) returns SkillDefinition with correct fields', () => {
    writeSkillFile(tmpDir, 'myskill.md', '---\nname: my-skill\ndescription: Does things\nallowed-tools: Read, Write, Bash\n---\n\nInstructions for the skill')

    const loader = new SkillLoader([tmpDir])
    const skill = loader.get('my-skill')

    expect(skill).toBeDefined()
    expect(skill!.name).toBe('my-skill')
    expect(skill!.description).toBe('Does things')
    expect(skill!.content).toBe('Instructions for the skill')
    expect(skill!.allowedTools).toEqual(['Read', 'Write', 'Bash'])
    expect(skill!.filePath).toBe(join(tmpDir, 'myskill.md'))
  })

  it('get() returns undefined for missing skill', () => {
    const loader = new SkillLoader([tmpDir])
    expect(loader.get('nonexistent')).toBeUndefined()
  })

  it('list() returns SkillMetadata array', () => {
    writeSkillFile(tmpDir, 'a.md', '---\nname: skill-a\ndescription: First\n---\nContent A')
    writeSkillFile(tmpDir, 'b.md', '---\nname: skill-b\ndescription: Second\n---\nContent B')

    const loader = new SkillLoader([tmpDir])
    const list = loader.list()

    expect(list.length).toBe(2)
    const names = list.map(s => s.name)
    expect(names).toContain('skill-a')
    expect(names).toContain('skill-b')
    for (const item of list) {
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('description')
    }
  })

  it('parses allowed-tools field (comma separated)', () => {
    writeSkillFile(tmpDir, 'tools.md', '---\nname: tools-skill\ndescription: Has tools\nallowed-tools: Read, Write, Glob\n---\nContent')

    const loader = new SkillLoader([tmpDir])
    const skill = loader.get('tools-skill')
    expect(skill!.allowedTools).toEqual(['Read', 'Write', 'Glob'])
  })

  it('falls back to "tools" field name', () => {
    writeSkillFile(tmpDir, 'fallback.md', '---\nname: fallback-skill\ndescription: Uses tools field\ntools: Bash, Grep\n---\nContent')

    const loader = new SkillLoader([tmpDir])
    const skill = loader.get('fallback-skill')
    expect(skill!.allowedTools).toEqual(['Bash', 'Grep'])
  })

  it('skips files without valid frontmatter (no name)', () => {
    writeSkillFile(tmpDir, 'noname.md', '---\ndescription: No name field\n---\nContent without a name')

    const loader = new SkillLoader([tmpDir])
    expect(loader.list().length).toBe(0)
  })

  it('handles non-existent directories gracefully', () => {
    const loader = new SkillLoader(['/tmp/nonexistent-dir-xyz-12345'])
    expect(loader.list().length).toBe(0)
  })

  it('skips non-.md files', () => {
    writeSkillFile(tmpDir, 'skill.md', '---\nname: real-skill\ndescription: Valid\n---\nContent')
    writeSkillFile(tmpDir, 'notskill.txt', '---\nname: fake-skill\ndescription: Should be skipped\n---\nContent')
    writeSkillFile(tmpDir, 'data.json', '{"name": "json-skill"}')

    const loader = new SkillLoader([tmpDir])
    expect(loader.list().length).toBe(1)
    expect(loader.list()[0].name).toBe('real-skill')
  })
})
