import * as readline from 'readline'
import { readdirSync, existsSync, statSync } from 'fs'
import { dirname, basename, join } from 'path'

export function setVimMode(_enabled: boolean): void { /* noop in CLI mode */ }
export function isVimMode(): boolean { return false }

export async function readInput(prompt = '> ', history?: string[], commands?: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt,
    history: history ? [...history].reverse() : [],
    historySize: 500,
    terminal: true,
    completer: commands ? (line: string) => {
      if (line.startsWith('/')) {
        const completed = completeCommand(line, commands)
        if (completed !== line) return [[completed], line]
        const prefix = line.slice(1)
        const matches = commands.filter(c => c.startsWith(prefix)).map(c => '/' + c)
        return [matches.length ? matches : [], line]
      }
      return [completePath(line, process.cwd()), line]
    } : undefined,
  })

  return new Promise((resolve) => {
    let resolved = false
    const finish = (result: string) => {
      if (resolved) return
      resolved = true
      rl.close()
      resolve(result)
    }
    rl.prompt()
    rl.on('line', (line) => finish(line))
    rl.on('close', () => finish((rl as any).line || ''))
  })
}

export async function readSingleLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim()) })
  })
}

export function completePath(partial: string, cwd: string): string[] {
  if (!partial) return []
  const fullPartial = partial.startsWith('/') ? partial : join(cwd, partial)
  const dir = partial.endsWith('/') ? fullPartial : dirname(fullPartial)
  const prefix = partial.endsWith('/') ? '' : basename(fullPartial)
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter(e => e.startsWith(prefix) && !e.startsWith('.'))
      .slice(0, 20)
      .map(e => {
        const isDir = statSync(join(dir, e)).isDirectory()
        const dirPart = partial.endsWith('/') ? partial : partial.slice(0, partial.length - prefix.length)
        return dirPart + e + (isDir ? '/' : '')
      })
  } catch { return [] }
}

export function completeCommand(input: string, commands: string[]): string {
  if (!input.startsWith('/')) {
    const matches = completePath(input, process.cwd())
    return matches.length === 1 ? matches[0] : input
  }
  const prefix = input.slice(1)
  const matches = commands.filter(c => c.startsWith(prefix))
  if (matches.length === 0) return input
  if (matches.length === 1) return '/' + matches[0]
  let common = matches[0]
  for (const m of matches.slice(1)) {
    let i = 0
    while (i < common.length && i < m.length && common[i] === m[i]) i++
    common = common.slice(0, i)
  }
  return '/' + common
}
