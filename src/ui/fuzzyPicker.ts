import * as readline from 'readline'
import { theme } from './theme.js'

export interface PickerItem {
  label: string
  value: string
  description?: string
}

function fuzzyMatch(query: string, text: string): { matches: boolean; score: number } {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()

  // Exact substring match
  if (lower.includes(q)) return { matches: true, score: 100 - lower.indexOf(q) }

  // Fuzzy: all chars in order
  let qi = 0
  let score = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      qi++
      score += (i === 0 || lower[i - 1] === '/' || lower[i - 1] === ' ') ? 10 : 1
    }
  }

  return { matches: qi === q.length, score }
}

export { fuzzyMatch }

export async function showFuzzyPicker(items: PickerItem[], prompt = 'Search: '): Promise<string | null> {
  return new Promise((resolve) => {
    let query = ''
    let selectedIdx = 0

    const render = () => {
      const filtered = items
        .map(item => ({ ...item, ...fuzzyMatch(query, item.label) }))
        .filter(i => !query || i.matches)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

      // Clear and redraw
      process.stdout.write('\x1B[2J\x1B[H') // Clear screen
      console.log(theme.bold(prompt) + query + theme.dim('|'))
      console.log()

      if (filtered.length === 0) {
        console.log(theme.dim('  No matches'))
      } else {
        for (let i = 0; i < filtered.length; i++) {
          const item = filtered[i]
          const prefix = i === selectedIdx ? theme.info('▸ ') : '  '
          const desc = item.description ? theme.dim(` — ${item.description}`) : ''
          console.log(`${prefix}${item.label}${desc}`)
        }
      }

      return filtered
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })

    // Raw mode for key-by-key input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }

    let filtered = render()

    process.stdin.on('data', (data: Buffer) => {
      const key = data.toString()

      if (key === '\x03' || key === '\x1b') { // Ctrl+C or Escape
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        rl.close()
        resolve(null)
        return
      }

      if (key === '\r' || key === '\n') { // Enter
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        rl.close()
        resolve(filtered[selectedIdx]?.value || null)
        return
      }

      if (key === '\x1b[A') { // Up arrow
        selectedIdx = Math.max(0, selectedIdx - 1)
        filtered = render()
        return
      }

      if (key === '\x1b[B') { // Down arrow
        selectedIdx = Math.min(filtered.length - 1, selectedIdx + 1)
        filtered = render()
        return
      }

      if (key === '\x7f' || key === '\b') { // Backspace
        query = query.slice(0, -1)
        selectedIdx = 0
        filtered = render()
        return
      }

      if (key.length === 1 && key >= ' ') { // Printable char
        query += key
        selectedIdx = 0
        filtered = render()
      }
    })
  })
}
