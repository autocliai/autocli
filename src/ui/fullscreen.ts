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
  inputRow: number       // first row of the input area
  inputLines: number     // number of lines the input area occupies
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
  private scrollCursorCol = 1
  private currentInputLines = 1

  constructor() {
    this.metrics = this.computeMetrics()
  }

  private computeMetrics(): LayoutMetrics {
    const rows = process.stdout.rows || 24
    const cols = process.stdout.columns || 80
    const n = this.currentInputLines
    return {
      rows,
      cols,
      scrollTop: 1,
      scrollBottom: rows - 2 - n,       // shrinks as input grows
      statusRow: rows - 1 - n,
      separatorRow: rows - n,
      inputRow: rows - n + 1,            // first input row
      inputLines: n,
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
    this.scrollCursorCol = 1

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
    const newCol = Math.min(this.scrollCursorCol, this.metrics.cols)
    process.stdout.write(moveTo(newRow, newCol))
    this.scrollCursorRow = newRow
    this.scrollCursorCol = newCol
  }

  // ── Scroll Region (output area) ───────────────────────────────────

  /** Write text into the scroll region. Handles newlines, scrolling automatically. */
  writeOutput(text: string): void {
    if (!this.entered) {
      process.stdout.write(text)
      return
    }

    const out = process.stdout
    out.write(saveCursor)
    out.write(setScrollRegion(this.metrics.scrollTop, this.metrics.scrollBottom))
    out.write(moveTo(this.scrollCursorRow, this.scrollCursorCol))
    out.write(text)

    // Track cursor position through the written text
    const { cols, scrollBottom } = this.metrics
    let row = this.scrollCursorRow
    let col = this.scrollCursorCol

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code === 0x1b) {
        // Skip ANSI escape sequences (don't move visible cursor)
        if (i + 1 < text.length) {
          const next = text.charCodeAt(i + 1)
          if (next === 0x5b) { // CSI: ESC [ ... <letter>
            i += 2
            while (i < text.length && text.charCodeAt(i) < 0x40) i++
            continue
          }
          if (next === 0x5d) { // OSC: ESC ] ... (ST or BEL)
            i += 2
            while (i < text.length) {
              if (text.charCodeAt(i) === 0x07) break // BEL
              if (text.charCodeAt(i) === 0x1b && i + 1 < text.length && text.charCodeAt(i + 1) === 0x5c) { i++; break } // ST
              i++
            }
            continue
          }
        }
        i++ // ESC + single char (e.g., ESC 7, ESC 8)
        continue
      }
      if (code === 0x0a) { // \n
        row = Math.min(row + 1, scrollBottom)
        col = 1
      } else if (code === 0x0d) { // \r
        col = 1
      } else {
        col++
        if (col > cols) {
          row = Math.min(row + 1, scrollBottom)
          col = 1
        }
      }
    }

    this.scrollCursorRow = row
    this.scrollCursorCol = col

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
      // Animated spinner + message + elapsed time + status fields on the right
      const frame = theme.info(SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length])
      const elapsed = this.formatElapsed(Date.now() - this.spinnerStartTime)
      const left = ` ${frame} ${this.spinnerMessage} ${theme.dim(elapsed)}`
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

  private spinnerStartTime = 0

  startSpinner(message: string): void {
    this.spinnerMessage = message
    this.spinnerFrame = 0
    this.spinnerRunning = true
    this.spinnerStartTime = Date.now()

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

  private formatElapsed(ms: number): string {
    const secs = Math.floor(ms / 1000)
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins}m${remSecs.toString().padStart(2, '0')}s`
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

  // ── Input area ─────────────────────────────────────────────────────

  /**
   * Resize the input area to `lines` rows. Redraws chrome and adjusts
   * the scroll region so the output area shrinks to make room.
   */
  setInputHeight(lines: number): void {
    if (!this.entered) return
    const clamped = Math.max(1, Math.min(lines, Math.floor((this.metrics.rows - 3) / 2)))
    if (clamped === this.currentInputLines) return
    this.currentInputLines = clamped
    this.metrics = this.computeMetrics()
    const { scrollTop, scrollBottom, inputRow, inputLines } = this.metrics

    const out = process.stdout
    out.write(setScrollRegion(scrollTop, scrollBottom))
    this.renderSeparator()
    this.renderStatusBar()

    // Clamp scroll cursor
    const newRow = Math.min(this.scrollCursorRow, scrollBottom)
    this.scrollCursorRow = newRow

    // Reposition cursor to the last input row so readline writes stay at the bottom
    out.write(moveTo(inputRow + inputLines - 1, 1))
  }

  /** Prepare the input area: clear all input rows and position cursor at the first */
  prepareInputRow(): void {
    if (!this.entered) return
    const { inputRow, inputLines } = this.metrics
    const out = process.stdout
    for (let r = inputRow; r < inputRow + inputLines; r++) {
      out.write(moveTo(r, 1))
      out.write(clearLine)
    }
    out.write(moveTo(inputRow, 1))
    out.write(showCursor)
  }

  /** Clear all input rows */
  clearInputRow(): void {
    if (!this.entered) return
    const { inputRow, inputLines } = this.metrics
    const out = process.stdout
    for (let r = inputRow; r < inputRow + inputLines; r++) {
      out.write(moveTo(r, 1))
      out.write(clearLine)
    }
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
