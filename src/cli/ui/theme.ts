import chalk from 'chalk'

export const theme = {
  error: (s: string) => chalk.red(s),
  success: (s: string) => chalk.green(s),
  warning: (s: string) => chalk.yellow(s),
  info: (s: string) => chalk.cyan(s),
  dim: (s: string) => chalk.dim(s),
  bold: (s: string) => chalk.bold(s),
  tool: (s: string) => chalk.magenta(s),
  command: (s: string) => chalk.blue.bold(s),
  key: (s: string) => chalk.yellow.bold(s),
  code: (s: string) => chalk.gray(s),
  highlight: (s: string) => chalk.bgYellow.black(s),
  separator: () => chalk.dim('─'.repeat(process.stdout.columns || 80)),
}
