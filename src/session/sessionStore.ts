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
    const metaPath = join(this.dir, `${session.id}.meta.json`)
    const messagesPath = join(this.dir, `${session.id}.jsonl`)

    // Save metadata (small, full rewrite is fine)
    const meta = {
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      workingDir: session.workingDir,
      totalCost: session.totalCost,
      totalTokens: session.totalTokens,
      title: session.title,
    }
    writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    // Write messages as JSONL (full rewrite — but could be append-only in future)
    const jsonl = session.messages.map(m => JSON.stringify(m)).join('\n')
    writeFileSync(messagesPath, jsonl)
  }

  load(id: string): Session | undefined {
    // Try new JSONL format first
    const metaPath = join(this.dir, `${id}.meta.json`)
    const messagesPath = join(this.dir, `${id}.jsonl`)

    if (existsSync(metaPath) && existsSync(messagesPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
        const lines = readFileSync(messagesPath, 'utf-8').trim().split('\n').filter(Boolean)
        const messages = lines
          .map(line => { try { return JSON.parse(line) } catch { return null } })
          .filter((m): m is NonNullable<typeof m> => m !== null)
        return { ...meta, messages }
      } catch {
        // Fall through to legacy format
      }
    }

    // Fallback: try legacy single JSON format
    const legacyPath = join(this.dir, `${id}.json`)
    if (existsSync(legacyPath)) {
      return JSON.parse(readFileSync(legacyPath, 'utf-8'))
    }

    return undefined
  }

  list(): SessionMetadata[] {
    if (!existsSync(this.dir)) return []

    const seen = new Set<string>()
    const results: SessionMetadata[] = []

    for (const f of readdirSync(this.dir)) {
      // New format: id.meta.json
      if (f.endsWith('.meta.json')) {
        const id = f.replace('.meta.json', '')
        seen.add(id)
        try {
          const meta = JSON.parse(readFileSync(join(this.dir, f), 'utf-8'))
          const messagesPath = join(this.dir, `${id}.jsonl`)
          const messageCount = existsSync(messagesPath)
            ? readFileSync(messagesPath, 'utf-8').trim().split('\n').filter(Boolean).length
            : 0
          results.push({
            id: meta.id,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
            workingDir: meta.workingDir,
            messageCount,
            title: meta.title,
          })
        } catch { /* skip corrupt meta files */ }
      }
    }

    // Legacy format: id.json (skip if already seen in new format)
    for (const f of readdirSync(this.dir)) {
      if (f.endsWith('.json') && !f.endsWith('.meta.json')) {
        const id = f.replace('.json', '')
        if (seen.has(id)) continue
        try {
          const session = JSON.parse(readFileSync(join(this.dir, f), 'utf-8')) as Session
          results.push({
            id: session.id,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            workingDir: session.workingDir,
            messageCount: session.messages.length,
          })
        } catch { /* skip corrupt files */ }
      }
    }

    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getLatest(): Session | undefined {
    const list = this.list()
    if (list.length === 0) return undefined
    return this.load(list[0].id)
  }
}
