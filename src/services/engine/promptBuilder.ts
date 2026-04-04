import type { MemoryStore } from '../../stores/memoryStore.js'
import type { BrainStore } from '../../stores/brainStore.js'
import { buildGitContext, buildProjectHint } from '../git/gitContext.js'
import { loadClaudeMdFiles } from './claudeMd.js'

const BASE_PROMPT = `You are an AI coding assistant. You help users with software engineering tasks.

# Instructions
- Use available tools to read, write, edit files and run commands.
- Be concise and direct. Lead with the answer, not the reasoning.
- Prefer editing existing files over creating new ones.
- Be careful not to introduce security vulnerabilities.
- Don't add features beyond what was asked.

# Environment
- Working directory: {workingDir}
- Platform: {platform}
- Shell: {shell}
`

export class PromptBuilder {
  constructor(private memoryStore: MemoryStore, private brainStore: BrainStore) {}

  async build(workingDir: string): Promise<string> {
    const parts: string[] = []
    parts.push(BASE_PROMPT.replace('{workingDir}', workingDir).replace('{platform}', process.platform).replace('{shell}', process.env.SHELL || '/bin/bash'))
    const gitCtx = await buildGitContext(workingDir)
    if (gitCtx) parts.push(gitCtx)
    const hint = await buildProjectHint(workingDir)
    if (hint) parts.push(hint)
    const memSection = this.memoryStore.buildPromptSection()
    if (memSection) parts.push(memSection)
    const claudeMd = await loadClaudeMdFiles(workingDir)
    if (claudeMd) parts.push(`\n## Project Instructions\n${claudeMd}`)
    return parts.join('\n')
  }
}
