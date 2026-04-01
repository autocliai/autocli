import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, openSync, closeSync, writeSync, readSync, ftruncateSync } from 'fs'
import { join } from 'path'
import type { Task, TaskStatus } from './types.js'

export class TaskStore {
  private dir: string
  private hwmPath: string

  constructor(dir: string) {
    this.dir = dir
    this.hwmPath = join(dir, '.highwatermark')
    mkdirSync(dir, { recursive: true })
  }

  create(subject: string, description: string, opts?: { activeForm?: string; metadata?: Record<string, unknown> }): Task {
    const id = String(this.nextId())
    const task: Task = {
      id,
      subject,
      description,
      status: 'pending',
      activeForm: opts?.activeForm,
      owner: undefined,
      blocks: [],
      blockedBy: [],
      metadata: opts?.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.save(task)
    return task
  }

  get(id: string): Task | undefined {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return undefined
    return JSON.parse(readFileSync(path, 'utf-8'))
  }

  update(id: string, fields: Partial<Pick<Task, 'subject' | 'description' | 'status' | 'activeForm' | 'owner' | 'metadata'>>): Task | undefined {
    const task = this.get(id)
    if (!task) return undefined
    Object.assign(task, fields, { updatedAt: new Date().toISOString() })
    this.save(task)
    return task
  }

  delete(id: string): boolean {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return false
    unlinkSync(path)
    for (const t of this.list()) {
      let changed = false
      if (t.blocks.includes(id)) { t.blocks = t.blocks.filter(b => b !== id); changed = true }
      if (t.blockedBy.includes(id)) { t.blockedBy = t.blockedBy.filter(b => b !== id); changed = true }
      if (changed) this.save(t)
    }
    return true
  }

  list(): Task[] {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(this.dir, f), 'utf-8')) as Task)
      .sort((a, b) => Number(a.id) - Number(b.id))
  }

  addBlock(blockerId: string, blockedId: string): void {
    const blocker = this.get(blockerId)
    const blocked = this.get(blockedId)
    if (!blocker || !blocked) return
    if (!blocker.blocks.includes(blockedId)) blocker.blocks.push(blockedId)
    if (!blocked.blockedBy.includes(blockerId)) blocked.blockedBy.push(blockerId)
    this.save(blocker)
    this.save(blocked)
  }

  private save(task: Task): void {
    writeFileSync(join(this.dir, `${task.id}.json`), JSON.stringify(task, null, 2))
  }

  private nextId(): number {
    // Atomic read-increment-write using file descriptor to avoid TOCTOU races
    const fd = openSync(this.hwmPath, 'a+')
    try {
      const buf = Buffer.alloc(32)
      const bytesRead = readSync(fd, buf, 0, 32, 0)
      const hwm = bytesRead > 0 ? Number(buf.slice(0, bytesRead).toString('utf-8').trim()) || 0 : 0
      const next = hwm + 1
      const data = Buffer.from(String(next))
      ftruncateSync(fd, 0)
      writeSync(fd, data, 0, data.length, 0)
      return next
    } finally {
      closeSync(fd)
    }
  }
}
