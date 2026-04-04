import { theme } from './theme.js'
import { readSingleLine } from './input.js'

export type PermissionAnswer = 'yes' | 'no' | 'always'

export async function promptPermission(
  toolName: string,
  description: string,
): Promise<PermissionAnswer> {
  console.log()
  console.log(theme.warning(`Permission requested: ${toolName}`))
  console.log(theme.dim(description))
  console.log(`  ${theme.info('[y]')} Yes  ${theme.info('[a]')} Always  ${theme.info('[n]')} No`)

  const answer = await readSingleLine('  Choice [y/a/n]: ')

  switch (answer.toLowerCase()) {
    case 'y': case 'yes': return 'yes'
    case 'a': case 'always': return 'always'
    default: return 'no'
  }
}
