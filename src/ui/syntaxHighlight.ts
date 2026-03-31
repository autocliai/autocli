import chalk from 'chalk'

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'class', 'return', 'if', 'else',
  'for', 'while', 'import', 'export', 'from', 'async', 'await',
  'try', 'catch', 'throw', 'new', 'this', 'super', 'extends',
  'default', 'switch', 'case', 'break', 'continue', 'typeof',
  'interface', 'type', 'enum', 'implements', 'public', 'private',
  'def', 'self', 'None', 'True', 'False', 'lambda', 'yield',
  'fn', 'pub', 'mut', 'impl', 'struct', 'trait', 'use', 'mod',
])

export function highlightCode(code: string, _lang?: string): string {
  return code.replace(/\b(\w+)\b/g, (match) => {
    if (KEYWORDS.has(match)) return chalk.magenta(match)
    if (/^[A-Z][a-zA-Z]*$/.test(match)) return chalk.yellow(match)
    return match
  })
  .replace(/(["'`])(?:(?!\1).)*\1/g, (match) => chalk.green(match))
  .replace(/\/\/.*$/gm, (match) => chalk.dim(match))
  .replace(/\/\*[\s\S]*?\*\//g, (match) => chalk.dim(match))
  .replace(/#.*$/gm, (match) => chalk.dim(match))
  .replace(/\b(\d+)\b/g, (_, n) => chalk.cyan(n))
}
