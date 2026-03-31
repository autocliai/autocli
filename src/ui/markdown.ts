import chalk from 'chalk'
import { highlightCode } from './syntaxHighlight.js'
import { theme } from './theme.js'

export function renderMarkdown(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('```') && !inCodeBlock) {
      inCodeBlock = true
      codeBlockLang = line.slice(3).trim()
      codeLines = []
      continue
    }

    if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false
      const highlighted = highlightCode(codeLines.join('\n'), codeBlockLang)
      result.push(theme.dim('┌─' + (codeBlockLang ? ` ${codeBlockLang} ` : '') + '─'))
      for (const cl of highlighted.split('\n')) {
        result.push(theme.dim('│ ') + cl)
      }
      result.push(theme.dim('└─'))
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    result.push(renderInline(line))
  }

  return result.join('\n')
}

function renderInline(line: string): string {
  // Headers
  const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
  if (headerMatch) {
    const level = headerMatch[1].length
    const text = headerMatch[2]
    if (level === 1) return chalk.bold.underline(text)
    if (level === 2) return chalk.bold(text)
    return chalk.bold.dim(text)
  }

  // Bullet lists
  if (/^\s*[-*]\s/.test(line)) {
    line = line.replace(/^(\s*)[-*]\s/, '$1• ')
  }

  // Numbered lists
  if (/^\s*\d+\.\s/.test(line)) {
    line = line.replace(/^(\s*)(\d+)\.\s/, `$1${chalk.dim('$2.')} `)
  }

  // Horizontal rule
  if (/^---+$/.test(line.trim())) {
    return theme.separator()
  }

  // Inline formatting
  line = line.replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t))
  line = line.replace(/\*(.+?)\*/g, (_, t) => chalk.italic(t))
  line = line.replace(/`(.+?)`/g, (_, t) => chalk.bgGray.white(` ${t} `))
  line = line.replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => `${chalk.blue.underline(text)} ${chalk.dim(`(${url})`)}`)

  return line
}
