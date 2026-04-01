export class ScrollBuffer {
  private lines: string[] = []
  private viewportHeight: number
  private scrollOffset = 0

  constructor(viewportHeight?: number) {
    this.viewportHeight = viewportHeight || (process.stdout.rows || 24) - 3 // Leave room for input
  }

  append(text: string): void {
    const newLines = text.split('\n')
    this.lines.push(...newLines)
    // Auto-scroll to bottom
    this.scrollOffset = Math.max(0, this.lines.length - this.viewportHeight)
  }

  getVisible(): string[] {
    return this.lines.slice(this.scrollOffset, this.scrollOffset + this.viewportHeight)
  }

  scrollUp(n = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - n)
  }

  scrollDown(n = 1): void {
    this.scrollOffset = Math.min(
      Math.max(0, this.lines.length - this.viewportHeight),
      this.scrollOffset + n
    )
  }

  scrollToTop(): void {
    this.scrollOffset = 0
  }

  scrollToBottom(): void {
    this.scrollOffset = Math.max(0, this.lines.length - this.viewportHeight)
  }

  get totalLines(): number {
    return this.lines.length
  }

  get isAtBottom(): boolean {
    return this.scrollOffset >= this.lines.length - this.viewportHeight
  }

  clear(): void {
    this.lines = []
    this.scrollOffset = 0
  }

  getScrollIndicator(): string {
    if (this.lines.length <= this.viewportHeight) return ''
    const pct = Math.round((this.scrollOffset / Math.max(1, this.lines.length - this.viewportHeight)) * 100)
    return ` [${pct}%]`
  }
}
