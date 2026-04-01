import type { ToolRegistry } from './registry.js'
import { fileReadTool } from './fileRead.js'
import { fileWriteTool } from './fileWrite.js'
import { fileEditTool } from './fileEdit.js'
import { globTool } from './glob.js'
import { grepTool } from './grep.js'
import { bashTool } from './bash.js'
import { agentTool } from './agent.js'
import type { SkillLoader } from '../skills/loader.js'
import { createSkillTool } from '../skills/skillTool.js'
import type { TaskStore } from '../tasks/taskStore.js'
import { createTaskTools } from '../tasks/taskTools.js'

export function registerAllTools(registry: ToolRegistry, skillLoader?: SkillLoader, taskStore?: TaskStore): void {
  registry.register(fileReadTool)
  registry.register(fileWriteTool)
  registry.register(fileEditTool)
  registry.register(globTool)
  registry.register(grepTool)
  registry.register(bashTool)
  registry.register(agentTool)
  if (skillLoader) {
    registry.register(createSkillTool(skillLoader))
  }
  if (taskStore) {
    const tasks = createTaskTools(taskStore)
    registry.register(tasks.create)
    registry.register(tasks.update)
    registry.register(tasks.list)
    registry.register(tasks.get)
  }
}
