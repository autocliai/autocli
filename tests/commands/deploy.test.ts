import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { deployCommand } from '../../src/cli/commands/deploy.js'
import { setupTestDb, teardownTestDb, makeContext, getTmpDir } from './helpers.js'
import { writeFileSync } from 'fs'
import { join } from 'path'

describe('deploy command', () => {
  beforeAll(() => setupTestDb())
  afterAll(() => teardownTestDb())

  test('no args returns usage', async () => {
    const result = await deployCommand.execute('', makeContext())
    expect(result.output).toContain('Usage')
    expect(result.output).toContain('blueprint')
  })

  test('nonexistent file returns error', async () => {
    const result = await deployCommand.execute('nonexistent.md', makeContext())
    expect(result.output).toContain('not found')
  })

  test('invalid blueprint returns parse error', async () => {
    const tmpDir = getTmpDir()
    const file = join(tmpDir, 'bad.md')
    writeFileSync(file, '# Not a valid blueprint\nJust some text.')
    const result = await deployCommand.execute('bad.md', makeContext())
    expect(result.output).toContain('error')
  })

  test('valid blueprint deploys successfully', async () => {
    const tmpDir = getTmpDir()
    const file = join(tmpDir, 'team.md')
    writeFileSync(file, `# Team: test-team

Goal: Test the deployment system

## Agent: test-worker
Type: general-purpose
Task: Run tests

### AGENT.md
You are a test worker agent.
`)
    const result = await deployCommand.execute('team.md', makeContext())
    expect(result.output).toContain('Deployed')
    expect(result.output).toContain('test-team')
    expect(result.output).toContain('test-worker')
  })

  test('blueprint with schedule creates schedule', async () => {
    const tmpDir = getTmpDir()
    const file = join(tmpDir, 'scheduled.md')
    writeFileSync(file, `# Team: sched-team

Goal: Scheduled work
Schedule: every 2h

## Agent: worker
Type: general-purpose
Task: Do work

### AGENT.md
You work on things.
`)
    const result = await deployCommand.execute('scheduled.md', makeContext())
    expect(result.output).toContain('Deployed')
    expect(result.output).toContain('Schedule')
    expect(result.output).toContain('2h')
  })

  test('has correct name and aliases', () => {
    expect(deployCommand.name).toBe('deploy')
    expect(deployCommand.aliases).toContain('blueprint')
  })
})
