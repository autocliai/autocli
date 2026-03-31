import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Session, SessionMetadata } from './types.js'

export class SessionStore {
  private dir: string

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  create(workingDir: string): Session {
    const session: Session = {
      id: randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workingDir,
      messages: [],
      totalCost: 0,
      totalTokens: { input: 0, output: 0 },
    }
    this.save(session)
    return session
  }

  save(session: Session): void {
    session.updatedAt = new Date().toISOString()
    const path = join(this.dir, `${session.id}.json`)
    writeFileSync(path, JSON.stringify(session, null, 2))
  }

  load(id: string): Session | undefined {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return undefined
    return JSON.parse(readFileSync(path, 'utf-8'))
  }

  list(): SessionMetadata[] {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const session = JSON.parse(readFileSync(join(this.dir, f), 'utf-8')) as Session
        return {
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          workingDir: session.workingDir,
          messageCount: session.messages.length,
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getLatest(): Session | undefined {
    const list = this.list()
    if (list.length === 0) return undefined
    return this.load(list[0].id)
  }
}
