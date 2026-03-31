import { theme } from './theme.js'

export class StatusLine {
  private fields: Map<string, string> = new Map()
  private visible = false

  set(key: string, value: string): void {
    this.fields.set(key, value)
    if (this.visible) this.render()
  }

  show(): void {
    this.visible = true
    this.render()
  }

  hide(): void {
    this.visible = false
    process.stdout.write(`\x1B[${process.stdout.rows};1H\x1B[K`)
  }

  private render(): void {
    const parts: string[] = []
    for (const [key, value] of this.fields) {
      parts.push(`${theme.dim(key + ':')} ${value}`)
    }
    const line = parts.join(theme.dim(' │ '))
    const row = process.stdout.rows || 24
    process.stdout.write(`\x1B7`)
    process.stdout.write(`\x1B[${row};1H`)
    process.stdout.write(`\x1B[K`)
    process.stdout.write(theme.dim(line))
    process.stdout.write(`\x1B8`)
  }
}
