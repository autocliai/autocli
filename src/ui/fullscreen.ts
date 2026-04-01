import { theme } from './theme.js'

/**
 * Fullscreen terminal layout with three fixed zones:
 *
 *   ┌─────────────────────────────┐  row 1
 *   │  Scroll region (output)     │  rows 1 .. (rows-3)
 *   │  conversation, tool results │
 *   │  ...                        │
 *   ├─────────────────────────────┤  row (rows-2) = status bar
 *   │ ⠋ Thinking...  4.2k↑ 1.1k↓ │
 *   ├─────────────────────────────┤  row (rows-1) = separator
 *   │ ─────────────────────────── │
 *   ├─────────────────────────────┤  row (rows)   = input line
 *   │ >  _                        │
 *   └─────────────────────────────┘
 */

const ESC = '\x1B'

// ANSI helpers
const moveTo = (row: number, col: number) => `${ESC}[${row};${col}H`
const clearLine = `${ESC}[2K`
const saveCursor = `${ESC}7`
const restoreCursor = `${ESC}8`
const hideCursor = `${ESC}[?25l`
const showCursor = `${ESC}[?25h`
const setScrollRegion = (top: number, bottom: number) => `${ESC}[${top};${bottom}r`
const resetScrollRegion = `${ESC}[r`

// Spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export interface LayoutMetrics {
  rows: number
  cols: number
  scrollTop: number
  scrollBottom: number
  statusRow: number
  separatorRow: number
  inputRow: number
}

export class FullscreenLayout {
  private metrics: LayoutMetrics
  private statusFields: Map<string, string> = new Map()
  private spinnerFrame = 0
  private spinnerMessage = ''
  private spinnerTimer: ReturnType<typeof setInterval> | null = null
  private spinnerRunning = false
  private entered = false
  private scrollCursorRow = 1

  constructor() {
    this.metrics = this.computeMetrics()
  }

  private computeMetrics(): LayoutMetrics {
    const rows = process.stdout.rows || 24
    const cols = process.stdout.columns || 80
    return {
      rows,
      cols,
      scrollTop: 1,
      scrollBottom: rows - 3,
      statusRow: rows - 2,
      separatorRow: rows - 1,
      inputRow: rows,
    }
  }

  /** Enter fullscreen mode: set up scroll region and draw chrome */
  enter(): void {
    if (this.entered) return
    this.entered = true
    this.metrics = this.computeMetrics()
    const { rows, scrollTop, scrollBottom } = this.metrics

    const out = process.stdout

    // Clear entire screen and move to top
    out.write(`${ESC}[2J${moveTo(1, 1)}`)

    // Set scroll region to the output area only
    out.write(setScrollRegion(scrollTop, scrollBottom))

    // Draw the fixed chrome
    this.renderSeparator()
    this.renderStatusBar()

    // Position cursor in the scroll region
    out.write(moveTo(scrollTop, 1))
    this.scrollCursorRow = scrollTop

    // Handle terminal resize
    out.on('resize', this.onResize)
  }

  /** Exit fullscreen mode: restore terminal */
  exit(): void {
    this.stopSpinner()
    if (!this.entered) return
    this.entered = false

    const out = process.stdout
    out.write(resetScrollRegion)
    out.write(showCursor)
    out.write(moveTo(this.metrics.rows, 1))
    out.write('\n')
    out.removeListener('resize', this.onResize)
  }

  private onResize = (): void => {
    if (!this.entered) return
    const oldBottom = this.metrics.scrollBottom
    this.metrics = this.computeMetrics()
    const { scrollTop, scrollBottom } = this.metrics

    // Reset scroll region to new size
    process.stdout.write(setScrollRegion(scrollTop, scrollBottom))

    // Redraw chrome
    this.renderSeparator()
    this.renderStatusBar()

    // Return cursor to scroll region
    const newRow = Math.min(this.scrollCursorRow, scrollBottom)
    process.stdout.write(moveTo(newRow, 1))
    this.scrollCursorRow = newRow
  }

  // ── Scroll Region (output area) ───────────────────────────────────

  /** Write text into the scroll region. Handles newlines, scrolling automatically. */
  writeOutput(text: string): void {
    if (!this.entered) {
      process.stdout.write(text)
      return
    }

    const out = process.stdout
    // Save cursor, ensure we're in scroll region
    out.write(saveCursor)
    out.write(setScrollRegion(this.metrics.scrollTop, this.metrics.scrollBottom))

    // Move to current scroll cursor position
    out.write(moveTo(this.scrollCursorRow, 1))
    out.write(text)

    // Track approximate row position (count newlines)
    const newlines = (text.match(/\n/g) || []).length
    this.scrollCursorRow = Math.min(
      this.scrollCursorRow + newlines,
      this.metrics.scrollBottom,
    )

    out.write(restoreCursor)
  }

  /** Write a full line to the scroll region, ending with newline */
  writeLine(text: string): void {
    this.writeOutput(text + '\n')
  }

  /** Replace console.log: write to scroll region */
  log(...args: unknown[]): void {
    const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    this.writeLine(text)
  }

  // ── Status Bar (animated line above separator) ────────────────────

  /** Set a status field (e.g., 'tokens', 'cost', 'model') */
  setStatus(key: string, value: string): void {
    this.statusFields.set(key, value)
    if (this.entered && !this.spinnerRunning) {
      this.renderStatusBar()
    }
  }

  /** Remove a status field */
  clearStatus(key: string): void {
    this.statusFields.delete(key)
    if (this.entered) this.renderStatusBar()
  }

  private renderStatusBar(): void {
    if (!this.entered) return
    const { statusRow, cols } = this.metrics
    const out = process.stdout

    out.write(saveCursor)
    out.write(moveTo(statusRow, 1))
    out.write(clearLine)

    if (this.spinnerRunning) {
      // Animated spinner + message + status fields on the right
      const frame = theme.info(SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length])
      const left = ` ${frame} ${this.spinnerMessage}`
      const right = this.buildStatusString()
      const gap = Math.max(1, cols - stripAnsi(left).length - stripAnsi(right).length - 1)
      out.write(left + ' '.repeat(gap) + right)
    } else {
      // Just status fields, centered-left
      const statusStr = this.buildStatusString()
      out.write(` ${statusStr}`)
    }

    out.write(restoreCursor)
  }

  private buildStatusString(): string {
    const parts: string[] = []
    for (const [key, value] of this.statusFields) {
      parts.push(`${theme.dim(key + ':')} ${value}`)
    }
    return parts.join(theme.dim(' │ '))
  }

  // ── Spinner (integrated into status bar) ──────────────────────────

  startSpinner(message: string): void {
    this.spinnerMessage = message
    this.spinnerFrame = 0
    this.spinnerRunning = true

    if (!this.entered) {
      // Fallback: inline spinner when not in fullscreen
      process.stdout.write(hideCursor)
    }

    this.spinnerTimer = setInterval(() => {
      this.spinnerFrame++
      this.renderStatusBar()
    }, 80)
  }

  updateSpinner(message: string): void {
    this.spinnerMessage = message
  }

  stopSpinner(finalMessage?: string): void {
    this.spinnerRunning = false
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer)
      this.spinnerTimer = null
    }

    if (!this.entered) {
      process.stdout.write('\r' + clearLine + showCursor)
      if (finalMessage) {
        process.stdout.write(`${theme.success('✓')} ${finalMessage}\n`)
      }
      return
    }

    process.stdout.write(showCursor)
    this.renderStatusBar()

    if (finalMessage) {
      this.writeLine(`${theme.success('✓')} ${finalMessage}`)
    }
  }

  failSpinner(message?: string): void {
    this.stopSpinner()
    if (message) {
      this.writeLine(`${theme.error('✗')} ${message}`)
    }
  }

  // ── Separator ─────────────────────────────────────────────────────

  private renderSeparator(): void {
    if (!this.entered) return
    const { separatorRow, cols } = this.metrics
    const out = process.stdout
    out.write(saveCursor)
    out.write(moveTo(separatorRow, 1))
    out.write(clearLine)
    out.write(theme.dim('─'.repeat(cols)))
    out.write(restoreCursor)
  }

  // ── Input line ────────────────────────────────────────────────────

  /** Prepare the input row: clear it and position cursor there */
  prepareInputRow(): void {
    if (!this.entered) return
    const { inputRow } = this.metrics
    const out = process.stdout
    out.write(moveTo(inputRow, 1))
    out.write(clearLine)
    out.write(showCursor)
  }

  /** Clear the input row and return cursor to scroll region */
  clearInputRow(): void {
    if (!this.entered) return
    const { inputRow } = this.metrics
    const out = process.stdout
    out.write(moveTo(inputRow, 1))
    out.write(clearLine)
  }

  // ── Accessors ─────────────────────────────────────────────────────

  getMetrics(): LayoutMetrics {
    return { ...this.metrics }
  }

  isEntered(): boolean {
    return this.entered
  }

  /** Get the number of rows available for scroll content */
  getScrollHeight(): number {
    return this.metrics.scrollBottom - this.metrics.scrollTop + 1
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let _layout: FullscreenLayout | null = null

export function getLayout(): FullscreenLayout {
  if (!_layout) _layout = new FullscreenLayout()
  return _layout
}

export function resetLayout(): void {
  if (_layout) {
    _layout.exit()
    _layout = null
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Strip ANSI escape codes for length calculation */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B[78]/g, '')
}
