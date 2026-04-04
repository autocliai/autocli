import { ToolRegistry } from './registry.js'
import { fileReadTool } from './fileRead.js'
import { fileWriteTool } from './fileWrite.js'
import { fileEditTool } from './fileEdit.js'
import { bashTool } from './bash.js'
import { globTool } from './glob.js'
import { grepTool } from './grep.js'
import { agentTool } from './agent.js'
import { thinkTool } from './think.js'
import { askUserTool } from './askUser.js'
import { enterPlanModeTool, exitPlanModeTool } from './planMode.js'
import { webFetchTool } from './webFetch.js'
import { webSearchTool } from './webSearch.js'
import { createBrainTools } from './brainTools.js'
import { createTaskTools } from './taskTools.js'
import { createTeamTools } from '../teams/teamTools.js'
import { createSkillTool } from '../skills/skillTool.js'
import type { BrainStore } from '../../stores/brainStore.js'
import type { TaskStore } from '../../stores/taskStore.js'
import type { TeamManager } from '../teams/teamManager.js'
import type { AgentStore } from '../../stores/agentStore.js'
import type { SkillLoader } from '../skills/loader.js'

export function registerAllTools(
  registry: ToolRegistry,
  brainStore: BrainStore,
  taskStore: TaskStore,
  teamManager?: TeamManager,
  agentStore?: AgentStore,
  skillLoader?: SkillLoader,
): void {
  registry.register(fileReadTool)
  registry.register(fileWriteTool)
  registry.register(fileEditTool)
  registry.register(bashTool)
  registry.register(globTool)
  registry.register(grepTool)
  registry.register(agentTool)
  registry.register(thinkTool)
  registry.register(askUserTool)
  registry.register(enterPlanModeTool)
  registry.register(exitPlanModeTool)
  registry.register(webFetchTool)
  registry.register(webSearchTool)
  const { brainNoteTool, brainRecallTool } = createBrainTools(brainStore)
  registry.register(brainNoteTool)
  registry.register(brainRecallTool)
  for (const tool of createTaskTools(taskStore)) registry.register(tool)
  if (teamManager && agentStore) {
    for (const tool of createTeamTools(teamManager, agentStore)) registry.register(tool)
  }
  if (skillLoader) {
    registry.register(createSkillTool(skillLoader))
  }
}
