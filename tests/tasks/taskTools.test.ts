import { describe, expect, test, beforeEach, afterAll } from 'bun:test'
import { createTaskTools } from '../../src/tasks/taskTools.js'
import { TaskStore } from '../../src/tasks/taskStore.js'
import { rmSync } from 'fs'

const TMP = '/tmp/mini-claude-test-task-tools'

let store: TaskStore
let tools: ReturnType<typeof createTaskTools>

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true })
  store = new TaskStore(TMP)
  tools = createTaskTools(store)
})
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('TaskCreate tool', () => {
  test('creates a task', async () => {
    const result = await tools.create.call(
      { subject: 'Fix bug', description: 'Fix the login bug' },
      { workingDir: '/tmp' }
    )
    expect(result.output).toContain('Fix bug')
    expect(result.isError).toBeFalsy()
  })
})

describe('TaskUpdate tool', () => {
  test('updates task status', async () => {
    store.create('Test', 'desc')
    const result = await tools.update.call(
      { taskId: '1', status: 'in_progress' },
      { workingDir: '/tmp' }
    )
    expect(result.output).toContain('Updated')
    expect(store.get('1')!.status).toBe('in_progress')
  })
})

describe('TaskList tool', () => {
  test('lists all tasks', async () => {
    store.create('A', 'desc')
    store.create('B', 'desc')
    const result = await tools.list.call({}, { workingDir: '/tmp' })
    expect(result.output).toContain('A')
    expect(result.output).toContain('B')
  })
})

describe('TaskGet tool', () => {
  test('gets task by id', async () => {
    store.create('My task', 'my desc')
    const result = await tools.get.call({ taskId: '1' }, { workingDir: '/tmp' })
    expect(result.output).toContain('My task')
    expect(result.output).toContain('my desc')
  })
})
