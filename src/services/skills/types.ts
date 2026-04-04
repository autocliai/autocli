export interface SkillMetadata { name: string; description: string; allowedTools?: string[] }
export interface SkillDefinition extends SkillMetadata { content: string; filePath: string }
