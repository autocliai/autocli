import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { MemoryEntry, MemoryType } from './types.js'

export class MemoryManager {
  private dir: string
  private indexPath: string

  constructor(dir: string) {
    this.dir = dir
    this.indexPath = join(dir, 'MEMORY.md')
    mkdirSync(dir, { recursive: true })
  }

  save(entry: MemoryEntry): void {
    const fileName = `${entry.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.md`
    const filePath = join(this.dir, fileName)

    const content = [
      '---',
      `name: ${entry.name}`,
      `description: ${entry.description}`,
      `type: ${entry.type}`,
      '---',
      '',
      entry.content,
    ].join('\n')

    writeFileSync(filePath, content)
    entry.filePath = filePath
    this.updateIndex()
  }

  get(name: string): MemoryEntry | undefined {
    const files = this.listFiles()
    for (const file of files) {
      const entry = this.parseFile(file)
      if (entry && entry.name === name) return entry
    }
    return undefined
  }

  list(): MemoryEntry[] {
    return this.listFiles()
      .map(f => this.parseFile(f))
      .filter((e): e is MemoryEntry => e !== undefined)
  }

  search(keyword: string): MemoryEntry[] {
    const lower = keyword.toLowerCase()
    return this.list().filter(e =>
      e.name.toLowerCase().includes(lower) ||
      e.description.toLowerCase().includes(lower) ||
      e.content.toLowerCase().includes(lower)
    )
  }

  delete(name: string): void {
    const files = this.listFiles()
    for (const file of files) {
      const entry = this.parseFile(file)
      if (entry && entry.name === name) {
        unlinkSync(file)
        this.updateIndex()
        return
      }
    }
  }

  getIndex(): string {
    if (!existsSync(this.indexPath)) return ''
    return readFileSync(this.indexPath, 'utf-8')
  }

  loadForPrompt(): string {
    const index = this.getIndex()
    if (!index.trim()) return ''

    const lines = index.split('\n')
    const capped = lines.length > 200 ? lines.slice(0, 200) : lines
    const truncated = lines.length > 200 ? '\n(... truncated, more memories available)' : ''

    return [
      '# Auto Memory',
      '',
      'Your persistent memory is stored in `' + this.dir + '`.',
      'The following is your MEMORY.md index:',
      '',
      capped.join('\n') + truncated,
    ].join('\n')
  }

  private listFiles(): string[] {
    if (!existsSync(this.dir)) return []
    return readdirSync(this.dir)
      .filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
      .map(f => join(this.dir, f))
  }

  private parseFile(filePath: string): MemoryEntry | undefined {
    const raw = readFileSync(filePath, 'utf-8')
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return undefined

    const frontmatter = match[1]
    const content = match[2].trim()

    const name = this.extractField(frontmatter, 'name')
    const description = this.extractField(frontmatter, 'description')
    const type = this.extractField(frontmatter, 'type') as MemoryType

    if (!name) return undefined

    return { name, description: description || '', type: type || 'user', content, filePath }
  }

  private extractField(text: string, field: string): string | undefined {
    const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
    return match ? match[1].trim() : undefined
  }

  private updateIndex(): void {
    const entries = this.list()
    const lines = entries.map(e => `- [${e.name}](${e.filePath.split('/').pop()}) — ${e.description}`)
    writeFileSync(this.indexPath, lines.join('\n') + '\n')
  }
}
