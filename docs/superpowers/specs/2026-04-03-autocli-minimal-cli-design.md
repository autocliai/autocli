# autocli — Minimal CLI Clone of autocliUI

## Overview

A 100% feature-complete clone of autocliUI (v0.2.1) that replaces the rich TUI layer with a minimal, readline-based CLI interface. All service, store, engine, tool, and provider logic is copied as-is. Only the presentation layer changes.

## Goals

- Feature parity with autocliUI: every command, tool, provider, store, and engine capability works identically
- Minimal CLI interface: simple readline input, plain stdout output, chalk coloring, no fullscreen/vim/scroll/fuzzy components
- Fully independent codebase: no shared packages or imports from autocliUI
- Same runtime (Bun) and dependencies

## Architecture

Three-layer architecture preserved:

```
CLI Layer (simplified) → Service Layer (identical) → Store Layer (identical) → SQLite + Filesystem
```

### Layers

**CLI Layer (changed):** Minimal readline-based REPL, simple console output, Y/n prompts. All 31 commands retained with simplified output formatting.

**Service Layer (copied as-is):** engine (queryEngine, toolExecutor, promptBuilder, contextManager, tokenCounter, autoExtract, backgroundTask), providers (openai, claudeLocal, minimaxi), permissions, hooks, skills, scheduler, git, events, teams.

**Store Layer (copied as-is):** db.ts + all 8 stores (session, memory, brain, task, agent, schedule, jobResult, config).

**Utils (copied as-is):** config, platform, logger, updater, zodToJson.

## UI Component Mapping

| autocliUI TUI Component | autocli CLI Replacement |
|---|---|
| `fullscreen.ts` (terminal layout manager) | Removed — direct stdout |
| `input.ts` (vim mode, autocomplete, history) | `readline` with basic history (500 items) |
| `stream.ts` (streaming text renderer) | `process.stdout.write()` for chunks |
| `markdown.ts` (rich markdown rendering) | `marked` terminal output with chalk |
| `spinner.ts` (animated spinner) | Simple stderr dots/text indicator |
| `progressBar.ts` (progress bar) | `[=====>   ] 60%` text on stderr |
| `scrollBuffer.ts` (scrollable buffer) | Removed — just print to stdout |
| `dialog.ts` (modal dialogs) | Simple readline Y/n prompt |
| `fuzzyPicker.ts` (fuzzy search picker) | Numbered list + "pick a number" input |
| `syntaxHighlight.ts` (code highlighting) | Kept as-is (chalk-based) |
| `diff.ts` (diff display) | Kept as-is |
| `theme.ts` (color theme) | Kept as-is |
| `errorFormat.ts` (error formatting) | Kept as-is |
| `permissionPrompt.ts` (permission UI) | Simple Y/n readline prompt |

## REPL Design

The REPL (`src/repl.ts`) uses Node/Bun `readline` interface:

1. Display prompt (`autocli> `)
2. Read user input line
3. If input starts with `/`, dispatch to command handler
4. Otherwise, send to QueryEngine as a user message
5. Stream response chunks to stdout via `process.stdout.write()`
6. On completion, show token/cost if configured, loop back to prompt

Session resume works via `--resume [id]` flag, same as autocliUI.

## Commands

All 31 commands from autocliUI are included:

- **Core**: help, vim (disabled/noop), model, yolo
- **Git**: commit, diff, review
- **Sessions**: sessions, export, compact, rewind
- **Data**: brain, tasks, memory
- **Planning**: plan
- **Config**: permissions, model, init, activate
- **Advanced**: team, schedule, agents, skills, deploy
- **Utility**: status, cost, context, clear, copy, search, doctor

The `vim` command becomes a noop (no vim mode in minimal CLI). All other commands function identically but output via `console.log` instead of TUI widgets.

## Project Structure

```
autocli/
├── src/
│   ├── index.ts              # Entry point (same init flow as autocliUI)
│   ├── repl.ts               # Simple readline REPL loop
│   ├── cli/
│   │   ├── commands/         # All 31 commands (console.log output)
│   │   │   ├── help.ts
│   │   │   ├── commit.ts
│   │   │   ├── diff.ts
│   │   │   ├── review.ts
│   │   │   ├── sessions.ts
│   │   │   ├── export.ts
│   │   │   ├── compact.ts
│   │   │   ├── rewind.ts
│   │   │   ├── brain.ts
│   │   │   ├── tasks.ts
│   │   │   ├── memory.ts
│   │   │   ├── plan.ts
│   │   │   ├── permissions.ts
│   │   │   ├── model.ts
│   │   │   ├── init.ts
│   │   │   ├── activate.ts
│   │   │   ├── team.ts
│   │   │   ├── schedule.ts
│   │   │   ├── agents.ts
│   │   │   ├── skills.ts
│   │   │   ├── deploy.ts
│   │   │   ├── status.ts
│   │   │   ├── cost.ts
│   │   │   ├── context.ts
│   │   │   ├── clear.ts
│   │   │   ├── copy.ts
│   │   │   ├── search.ts
│   │   │   ├── doctor.ts
│   │   │   ├── yolo.ts
│   │   │   └── vim.ts
│   │   └── ui/               # Minimal UI helpers
│   │       ├── input.ts      # readline wrapper with history
│   │       ├── stream.ts     # stdout chunk writer
│   │       ├── prompt.ts     # Y/n and numbered-list prompts
│   │       ├── markdown.ts   # marked terminal renderer
│   │       ├── spinner.ts    # Simple text spinner on stderr
│   │       ├── theme.ts      # Chalk color definitions
│   │       ├── syntaxHighlight.ts  # Code highlighting
│   │       ├── diff.ts       # Diff display
│   │       └── errorFormat.ts # Error formatting
│   ├── services/             # Copied verbatim from autocliUI
│   │   ├── engine/
│   │   │   ├── queryEngine.ts
│   │   │   ├── toolExecutor.ts
│   │   │   ├── promptBuilder.ts
│   │   │   ├── contextManager.ts
│   │   │   ├── tokenCounter.ts
│   │   │   ├── autoExtract.ts
│   │   │   └── backgroundTask.ts
│   │   ├── tools/
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   ├── registerAll.ts
│   │   │   ├── fileRead.ts
│   │   │   ├── fileWrite.ts
│   │   │   ├── fileEdit.ts
│   │   │   ├── bash.ts
│   │   │   ├── glob.ts
│   │   │   ├── grep.ts
│   │   │   ├── webFetch.ts
│   │   │   ├── webSearch.ts
│   │   │   ├── agent.ts
│   │   │   ├── think.ts
│   │   │   ├── askUser.ts
│   │   │   ├── planMode.ts
│   │   │   ├── brainTools.ts
│   │   │   └── taskTools.ts
│   │   ├── providers/
│   │   │   ├── types.ts
│   │   │   ├── openai.ts
│   │   │   ├── claudeLocal.ts
│   │   │   └── minimaxi.ts
│   │   ├── teams/
│   │   │   ├── teamManager.ts
│   │   │   ├── templateLoader.ts
│   │   │   ├── teamTools.ts
│   │   │   ├── blueprintParser.ts
│   │   │   └── types.ts
│   │   ├── permissions/
│   │   ├── hooks/
│   │   ├── skills/
│   │   ├── scheduler/
│   │   ├── git/
│   │   └── events/
│   ├── stores/               # Copied verbatim from autocliUI
│   │   ├── db.ts
│   │   ├── sessionStore.ts
│   │   ├── memoryStore.ts
│   │   ├── brainStore.ts
│   │   ├── taskStore.ts
│   │   ├── agentStore.ts
│   │   ├── scheduleStore.ts
│   │   ├── jobResultStore.ts
│   │   └── configStore.ts
│   └── utils/                # Copied verbatim from autocliUI
│       ├── config.ts
│       ├── platform.ts
│       ├── logger.ts
│       ├── updater.ts
│       └── zodToJson.ts
├── skills/                   # Copied from autocliUI
├── teams/                    # Copied from autocliUI
├── package.json              # Same deps: zod, chalk, marked, bun-types, typescript
├── tsconfig.json
└── .gitignore
```

## Dependencies

```json
{
  "dependencies": {
    "zod": "^3.24.0",
    "chalk": "^5.4.1",
    "marked": "^15.0.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.7.0"
  }
}
```

## Configuration

Same config file location: `~/.config/autocli/config.json`
Same database: `~/.config/autocli/autocli.db`

Both autocli and autocliUI share the same config and database, so switching between them is seamless.

## Entry Point / CLI Usage

```
autocli                        # Start interactive REPL
autocli "prompt"               # One-shot query
autocli --resume [id]          # Resume session
autocli -m <model>             # Specify model
autocli --provider <name>      # Provider selection
autocli --set-key <key>        # Save API key
autocli --scheduler            # Run scheduler daemon
autocli --run-team <name>      # Execute team template
```

## Testing

Copy test files from autocliUI. Store/service tests should pass without changes. UI tests will need adaptation for the new minimal components.

## Non-Goals

- No TUI components (fullscreen, vim mode, scroll buffers, fuzzy picker)
- No pipe-friendly/JSON output mode (can be added later)
- No new features beyond what autocliUI has
