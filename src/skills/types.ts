export interface SkillDefinition {
  name: string
  description: string
  content: string
  filePath: string
  allowedTools?: string[]
}

export interface SkillMetadata {
  name: string
  description: string
}
