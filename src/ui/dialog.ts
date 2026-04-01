import { theme } from './theme.js'
import { readSingleLine } from './input.js'

export interface DialogOption {
  key: string
  label: string
}

export async function showDialog(title: string, message: string, options: DialogOption[]): Promise<string> {
  const width = Math.min(60, process.stdout.columns || 80)
  const border = '─'.repeat(width - 2)

  console.log()
  console.log(theme.bold(`╭${border}╮`))
  console.log(theme.bold(`│ ${title.padEnd(width - 3)}│`))
  console.log(theme.bold(`├${border}┤`))

  // Word-wrap message
  const words = message.split(' ')
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).length > width - 4) {
      console.log(`│ ${line.padEnd(width - 3)}│`)
      line = word
    } else {
      line = line ? line + ' ' + word : word
    }
  }
  if (line) console.log(`│ ${line.padEnd(width - 3)}│`)

  console.log(`│${' '.repeat(width - 2)}│`)

  for (const opt of options) {
    console.log(`│  ${theme.info(`[${opt.key}]`)} ${opt.label.padEnd(width - 8)}│`)
  }

  console.log(theme.bold(`╰${border}╯`))

  const keys = options.map(o => o.key)
  const answer = await readSingleLine(`  Choice [${keys.join('/')}]: `)
  return answer.toLowerCase()
}

export async function showConfirm(title: string, message: string): Promise<boolean> {
  const result = await showDialog(title, message, [
    { key: 'y', label: 'Yes' },
    { key: 'n', label: 'No' },
  ])
  return result === 'y' || result === 'yes'
}

export async function showAlert(title: string, message: string): Promise<void> {
  const width = Math.min(60, process.stdout.columns || 80)
  const border = '─'.repeat(width - 2)
  console.log()
  console.log(theme.bold(`╭${border}╮`))
  console.log(theme.bold(`│ ${title.padEnd(width - 3)}│`))
  console.log(theme.bold(`├${border}┤`))
  console.log(`│ ${message.slice(0, width - 3).padEnd(width - 3)}│`)
  console.log(theme.bold(`╰${border}╯`))
  await readSingleLine(theme.dim('  Press Enter to continue...'))
}
