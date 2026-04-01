import { getLayout } from './fullscreen.js'

export class StreamRenderer {
  private buffer = ''
  private writeToStdout: boolean

  constructor(writeToStdout = true) {
    this.writeToStdout = writeToStdout
  }

  write(chunk: string): void {
    this.buffer += chunk
    if (this.writeToStdout) {
      const layout = getLayout()
      if (layout.isEntered()) {
        layout.writeOutput(chunk)
      } else {
        process.stdout.write(chunk)
      }
    }
  }

  /** Buffer text without writing to stdout (for cases where stdout is handled separately) */
  capture(chunk: string): void {
    this.buffer += chunk
  }

  clear(): void {
    this.buffer = ''
  }

  getContent(): string {
    return this.buffer
  }

  newline(): void {
    if (this.writeToStdout) {
      const layout = getLayout()
      if (layout.isEntered()) {
        layout.writeOutput('\n')
      } else {
        process.stdout.write('\n')
      }
    }
  }
}
