import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { Git } from '../../src/git/git.js'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

const TMP = '/tmp/mini-claude-test-git'

beforeAll(async () => {
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  const run = (cmd: string) => Bun.spawnSync(['bash', '-c', cmd], { cwd: TMP })
  run('git init')
  run('git config user.email "test@test.com"')
  run('git config user.name "Test"')
  writeFileSync(join(TMP, 'file.txt'), 'initial')
  run('git add . && git commit -m "init"')
})

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('Git', () => {
  test('detects git repo', async () => {
    const git = new Git(TMP)
    expect(await git.isRepo()).toBe(true)
  })

  test('gets status', async () => {
    const git = new Git(TMP)
    const status = await git.status()
    expect(typeof status).toBe('string')
  })

  test('gets log', async () => {
    const git = new Git(TMP)
    const log = await git.log(5)
    expect(log).toContain('init')
  })

  test('detects non-repo', async () => {
    const git = new Git('/tmp')
    expect(await git.isRepo()).toBe(false)
  })
})
