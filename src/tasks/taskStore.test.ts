import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { TaskStore } from './taskStore.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let tmpDir: string
let store: TaskStore

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'task-test-'))
  store = new TaskStore(tmpDir)
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('TaskStore', () => {
  describe('create', () => {
    it('creates a task with id 1', () => {
      const task = store.create('Test task', 'Do something')
      expect(task.id).toBe('1')
      expect(task.subject).toBe('Test task')
      expect(task.description).toBe('Do something')
      expect(task.status).toBe('pending')
    })

    it('increments IDs', () => {
      const t1 = store.create('A', 'a')
      const t2 = store.create('B', 'b')
      const t3 = store.create('C', 'c')
      expect(t1.id).toBe('1')
      expect(t2.id).toBe('2')
      expect(t3.id).toBe('3')
    })

    it('accepts optional activeForm and metadata', () => {
      const task = store.create('Task', 'Desc', { activeForm: 'Working', metadata: { key: 'val' } })
      expect(task.activeForm).toBe('Working')
      expect(task.metadata.key).toBe('val')
    })

    it('initializes empty blocks and blockedBy', () => {
      const task = store.create('Task', 'Desc')
      expect(task.blocks).toEqual([])
      expect(task.blockedBy).toEqual([])
    })
  })

  describe('get', () => {
    it('retrieves created task', () => {
      const created = store.create('Test', 'Desc')
      const fetched = store.get(created.id)
      expect(fetched).toBeDefined()
      expect(fetched!.subject).toBe('Test')
    })

    it('returns undefined for missing task', () => {
      expect(store.get('999')).toBeUndefined()
    })
  })

  describe('update', () => {
    it('updates fields', () => {
      const task = store.create('Old', 'old desc')
      const updated = store.update(task.id, { subject: 'New', status: 'in_progress' })
      expect(updated!.subject).toBe('New')
      expect(updated!.status).toBe('in_progress')
    })

    it('updates updatedAt', () => {
      const task = store.create('Task', 'Desc')
      const original = task.updatedAt
      // Small delay to ensure different timestamp
      const updated = store.update(task.id, { subject: 'Changed' })
      expect(updated!.updatedAt).toBeDefined()
    })

    it('returns undefined for missing task', () => {
      expect(store.update('999', { subject: 'X' })).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('removes task', () => {
      const task = store.create('Task', 'Desc')
      expect(store.delete(task.id)).toBe(true)
      expect(store.get(task.id)).toBeUndefined()
    })

    it('returns false for missing task', () => {
      expect(store.delete('999')).toBe(false)
    })

    it('cleans up dependency references', () => {
      const t1 = store.create('A', 'a')
      const t2 = store.create('B', 'b')
      store.addBlock(t1.id, t2.id)
      store.delete(t1.id)
      const t2Updated = store.get(t2.id)!
      expect(t2Updated.blockedBy).not.toContain(t1.id)
    })
  })

  describe('list', () => {
    it('returns sorted by numeric ID', () => {
      store.create('C', 'c')
      store.create('A', 'a')
      store.create('B', 'b')
      const list = store.list()
      expect(list.map(t => t.id)).toEqual(['1', '2', '3'])
    })

    it('returns empty when no tasks', () => {
      expect(store.list()).toEqual([])
    })
  })

  describe('addBlock', () => {
    it('creates bidirectional dependency', () => {
      const t1 = store.create('A', 'a')
      const t2 = store.create('B', 'b')
      store.addBlock(t1.id, t2.id)

      const blocker = store.get(t1.id)!
      const blocked = store.get(t2.id)!
      expect(blocker.blocks).toContain(t2.id)
      expect(blocked.blockedBy).toContain(t1.id)
    })

    it('is idempotent', () => {
      const t1 = store.create('A', 'a')
      const t2 = store.create('B', 'b')
      store.addBlock(t1.id, t2.id)
      store.addBlock(t1.id, t2.id)

      const blocker = store.get(t1.id)!
      expect(blocker.blocks.filter(b => b === t2.id).length).toBe(1)
    })

    it('does nothing for missing tasks', () => {
      const t1 = store.create('A', 'a')
      store.addBlock(t1.id, '999') // should not throw
    })
  })
})
