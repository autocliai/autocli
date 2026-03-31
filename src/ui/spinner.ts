import { theme } from './theme.js'

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
    process.stdout.write('\x1B[?25l') // hide cursor
    this.timer = setInterval(() => {
      const frame = theme.info(FRAMES[this.frameIndex % FRAMES.length])
      process.stdout.write(`\r${frame} ${this.message}`)
      this.frameIndex++
    }, 80)
  }

  update(message: string): void {
    this.message = message
  }

  stop(finalMessage?: string): void {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    process.stdout.write('\r\x1B[K') // clear line
    process.stdout.write('\x1B[?25h') // show cursor
    if (finalMessage) {
      process.stdout.write(`${theme.success('✓')} ${finalMessage}\n`)
    }
  }

  fail(message?: string): void {
    this.stop()
    if (message) {
      process.stdout.write(`${theme.error('✗')} ${message}\n`)
    }
  }
}
