import { theme } from './theme.js'
import { getLayout } from './fullscreen.js'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class Spinner {
  message: string
  isRunning = false
  private frameIndex = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private startTime = 0

  constructor(message: string) {
    this.message = message
  }

  private formatElapsed(ms: number): string {
    const secs = Math.floor(ms / 1000)
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins}m${remSecs.toString().padStart(2, '0')}s`
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.frameIndex = 0
    this.startTime = Date.now()

    const layout = getLayout()
    if (layout.isEntered()) {
      layout.startSpinner(this.message)
    } else {
      process.stdout.write('\x1B[?25l') // hide cursor
      this.timer = setInterval(() => {
        const frame = theme.info(FRAMES[this.frameIndex % FRAMES.length])
        const elapsed = theme.dim(this.formatElapsed(Date.now() - this.startTime))
        process.stdout.write(`\r\x1B[K${frame} ${this.message} ${elapsed}`)
        this.frameIndex++
      }, 80)
    }
  }

  update(message: string): void {
    this.message = message
    const layout = getLayout()
    if (layout.isEntered()) {
      layout.updateSpinner(message)
    }
  }

  stop(finalMessage?: string): void {
    if (!this.isRunning) return
    this.isRunning = false

    const layout = getLayout()
    if (layout.isEntered()) {
      layout.stopSpinner(finalMessage)
    } else {
      if (this.timer) clearInterval(this.timer)
      this.timer = null
      process.stdout.write('\r\x1B[K') // clear line
      process.stdout.write('\x1B[?25h') // show cursor
      if (finalMessage) {
        process.stdout.write(`${theme.success('✓')} ${finalMessage}\n`)
      }
    }
  }

  fail(message?: string): void {
    this.isRunning = false

    const layout = getLayout()
    if (layout.isEntered()) {
      layout.failSpinner(message)
    } else {
      this.stop()
      if (message) {
        process.stdout.write(`${theme.error('✗')} ${message}\n`)
      }
    }
  }
}
