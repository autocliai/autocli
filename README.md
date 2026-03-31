# Mini Claude

A minimal, fully-featured AI coding assistant CLI. All the power of Claude Code in ~8,500 lines.

## Quick Start

```bash
# Install
bun install

# Set API key
export ANTHROPIC_API_KEY=sk-ant-...
# or
bun src/index.ts --set-key sk-ant-...

# Start interactive REPL
bun src/index.ts

# One-shot query
bun src/index.ts "explain this codebase"

# Resume last session
bun src/index.ts --resume

# Headless daemon mode
bun src/index.ts --headless --port 3456
```

## 16 Capability Groups

| # | Capability | Description |
|---|-----------|-------------|
| 1 | Query Engine | LLM streaming + tool execution loop |
| 2 | Tools | Read, Write, Edit, Glob, Grep, Bash, Agent |
| 3 | Shell | System command execution with timeout |
| 4 | File Operations | Surgical edits, line-numbered reads |
| 5 | Commands | /help, /cost, /diff, /commit, /compact |
| 6 | Skills | Reusable workflow templates (markdown) |
| 7 | Memory | Persistent cross-session context |
| 8 | Permissions | Approve/deny/always for tool calls |
| 9 | Context Management | Auto-compact long conversations |
| 10 | Session Persistence | Save/resume conversations |
| 11 | Git Integration | Status, diff, log, commit |
| 12 | Agent Orchestration | Spawn sub-agents for parallel tasks |
| 13 | Hooks | User-defined event triggers |
| 14 | Terminal UI | Markdown, syntax highlighting, diffs, spinner |
| 15 | Remote Control | HTTP/SSE API, headless daemon |
| 16 | Authentication | JWT + API key for remote access |

## Remote API

When running in headless mode (`--headless`):

```bash
# Health check
curl http://localhost:3456/health

# Chat
curl -X POST http://localhost:3456/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "workingDir": "/my/project"}'

# Stream (SSE)
curl -X POST http://localhost:3456/chat/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "explain this code"}'

# Status
curl http://localhost:3456/status \
  -H "Authorization: Bearer <token>"
```

## Configuration

Settings are stored in `~/.mini-claude/config.json`:

```json
{
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 8192,
  "permissionMode": "default",
  "hooks": [],
  "remotePort": 3456
}
```

## Skills

Place `.md` files with frontmatter in `~/.mini-claude/skills/`:

```markdown
---
name: my-skill
description: Does a thing
---

Instructions for the LLM...
```

## Memory

Memories are stored in `~/.mini-claude/memory/` as markdown files with frontmatter. Types: `user`, `feedback`, `project`, `reference`.

## Development

```bash
bun test              # Run all tests
bun run dev           # Watch mode
bun run typecheck     # Type check
```
