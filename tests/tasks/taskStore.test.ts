import { describe, expect, test, afterAll, beforeEach } from 'bun:test'
import { TaskStore } from '../../src/tasks/taskStore.js'
import { rmSync } from 'fs'

const TMP = '/tmp/mini-claude-test-tasks'

beforeEach(() => rmSync(TMP, { recursive: true, force: true }))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe('TaskStore', () => {
  test('creates a task with auto-incremented id', () => {
    const store = new TaskStore(TMP)
    const task = store.create('Fix bug', 'Fix the login bug')
    expect(task.id).toBe('1')
    expect(task.subject).toBe('Fix bug')
    expect(task.status).toBe('pending')
  })

  test('increments id for each new task', () => {
    const store = new TaskStore(TMP)
    store.create('Task 1', 'desc')
    const t2 = store.create('Task 2', 'desc')
    expect(t2.id).toBe('2')
  })

  test('retrieves task by id', () => {
    const store = new TaskStore(TMP)
    store.create('My task', 'desc')
    const task = store.get('1')
    expect(task).toBeDefined()
    expect(task!.subject).toBe('My task')
  })

  test('updates task fields', () => {
    const store = new TaskStore(TMP)
    store.create('My task', 'desc')
    store.update('1', { status: 'in_progress' })
    const task = store.get('1')
    expect(task!.status).toBe('in_progress')
  })

  test('lists all tasks', () => {
    const store = new TaskStore(TMP)
    store.create('A', 'a')
    store.create('B', 'b')
    const list = store.list()
    expect(list).toHaveLength(2)
  })

  test('deletes a task', () => {
    const store = new TaskStore(TMP)
    store.create('Delete me', 'x')
    store.delete('1')
    expect(store.get('1')).toBeUndefined()
  })

  test('blocks/blockedBy relationships', () => {
    const store = new TaskStore(TMP)
    store.create('T1', 'd1')
    store.create('T2', 'd2')
    store.addBlock('1', '2')
    const t1 = store.get('1')
    const t2 = store.get('2')
    expect(t1!.blocks).toContain('2')
    expect(t2!.blockedBy).toContain('1')
  })
})
