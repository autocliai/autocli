import { applyInlineMarkdown } from './streamMarkdown.js'

export function renderMarkdown(text: string): string {
  return text.split('\n').map(line => applyInlineMarkdown(line)).join('\n')
}
