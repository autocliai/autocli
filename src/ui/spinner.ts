import { theme } from './theme.js'
import { getLayout } from './fullscreen.js'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class Spinner {
  message: string
  isRunning = false
  private frameIndex = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(message: string) {
    this.message = message
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.frameIndex = 0

    const layout = getLayout()
    if (layout.isEntered()) {
      layout.startSpinner(this.message)
    } else {
      process.stdout.write('\x1B[?25l') // hide cursor
      this.timer = setInterval(() => {
        const frame = theme.info(FRAMES[this.frameIndex % FRAMES.length])
        process.stdout.write(`\r${frame} ${this.message}`)
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
