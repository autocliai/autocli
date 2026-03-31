import { theme } from './theme.js'
import { readSingleLine } from './input.js'

export type PermissionAnswer = 'yes' | 'no' | 'always'

export async function promptPermission(
  toolName: string,
  description: string,
): Promise<PermissionAnswer> {
  console.log()
  console.log(theme.warning('⚠ Tool requires approval:'))
  console.log(`  ${theme.tool(toolName)}: ${description}`)
  console.log()

  const answer = await readSingleLine(
    `  Allow? ${theme.dim('[y]es / [n]o / [a]lways')} > `
  )

  switch (answer.toLowerCase()) {
    case 'y': case 'yes': return 'yes'
    case 'a': case 'always': return 'always'
    default: return 'no'
  }
}
