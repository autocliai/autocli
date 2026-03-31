import * as readline from 'readline'
import { theme } from './theme.js'

export async function readInput(prompt = '> '): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt,
  })

  return new Promise((resolve) => {
    const lines: string[] = []
    let multiline = false

    rl.prompt()

    rl.on('line', (line) => {
      if (line === '' && !multiline && lines.length > 0) {
        rl.close()
        resolve(lines.join('\n'))
        return
      }
      if (line === '\\' && !multiline) {
        multiline = true
        rl.setPrompt(theme.dim('... '))
        rl.prompt()
        return
      }
      if (line === '' && multiline) {
        rl.close()
        resolve(lines.join('\n'))
        return
      }
      lines.push(line)
      if (multiline) {
        rl.setPrompt(theme.dim('... '))
      }
      rl.prompt()
    })

    rl.on('close', () => {
      resolve(lines.join('\n'))
    })
  })
}

export async function readSingleLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}
