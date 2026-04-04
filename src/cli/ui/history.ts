import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export class InputHistory {
  private entries: string[] = []
  private index = -1
  private filePath: string
  private maxEntries = 500

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  add(entry: string): void {
    if (!entry.trim()) return
    // Remove duplicate if exists
    this.entries = this.entries.filter(e => e !== entry)
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries)
    }
    this.index = this.entries.length
    this.save()
  }

  previous(current: string): string {
    if (this.entries.length === 0) return current
    if (this.index > 0) this.index--
    return this.entries[this.index] || current
  }

  next(current: string): string {
    if (this.index >= this.entries.length - 1) {
      this.index = this.entries.length
      return ''
    }
    this.index++
    return this.entries[this.index] || current
  }

  reset(): void {
    this.index = this.entries.length
  }

  getEntries(): string[] {
    return [...this.entries]
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        // Entries are stored as JSON lines to preserve multi-line entries
        const lines = readFileSync(this.filePath, 'utf-8').trim().split('\n').filter(Boolean)
        this.entries = lines.map(line => { try { return JSON.parse(line) } catch { return line } })
        this.index = this.entries.length
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      // Store as JSON lines to safely handle multi-line entries
      writeFileSync(this.filePath, this.entries.map(e => JSON.stringify(e)).join('\n'))
    } catch { /* ignore */ }
  }
}
