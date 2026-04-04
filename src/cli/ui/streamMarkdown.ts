import chalk from 'chalk'

// Lightweight inline markdown for single lines
export function applyInlineMarkdown(line: string): string {
  // Skip if inside a code block (caller should track this)
  if (line.startsWith('```')) return line

  line = line.replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t))
  line = line.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, (_, t) => chalk.italic(t))
  line = line.replace(/`([^`]+?)`/g, (_, t) => chalk.bgGray.white(` ${t} `))
  return line
}
