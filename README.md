<p align="center">
  <h1 align="center">autocli</h1>
  <p align="center">A fast, minimal AI coding assistant for the terminal.<br>Built with Bun + TypeScript. ~10K lines of production code.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/tests-365_passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

---

## Quick Start

```bash
bun install
export ANTHROPIC_API_KEY=sk-ant-...
bun start
```

One-shot mode: `bun src/index.ts "explain this codebase"`

## Features

**Core** -- Interactive REPL with streaming responses, tool execution loop, and context management.

**Multi-provider** -- Anthropic (default), OpenAI-compatible, MinimaXI, or local Claude CLI.

**Full toolkit** -- File read/write/edit, glob, grep, bash, web fetch/search, sub-agents, and a think tool for reasoning.

**Second Brain** -- Persistent knowledge store using the PARA method. Auto-extracts memories from conversations. `/brain search`, `/brain distill`.

**Teams** -- Multi-agent orchestration. Define teams of specialized agents, run them in parallel, save as reusable templates.

**Remote Control** -- `/rc` starts a browser session with QR code. Users scan to open a live terminal UI. Powered by [eclaw-router](https://github.com/nicekid1/eclaw-router).

**WebSocket API** -- Real-time bidirectional protocol on `/ws` with control commands: interrupt, switch model, change permissions, adjust tokens.

**Scheduling** -- Recurring team runs with `/schedule`. Run as daemon with `--scheduler`.

**Sessions** -- Save and resume conversations. `--resume` picks up where you left off.

**Permissions** -- Approve, deny, or auto-approve tool calls. Configurable per-tool rules with glob patterns.

**Git-aware** -- Automatic repo context, `/diff`, `/commit`, `/review`.

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model <name>` | Switch model (sonnet, opus, haiku, local, minimax) |
| `/plan` | Toggle read-only exploration mode |
| `/yolo` | Toggle auto-approve for all tools |
| `/commit` | AI-assisted git commit |
| `/diff` | Show working tree changes |
| `/review` | Code review staged/unstaged changes |
| `/brain <cmd>` | Knowledge management (stats, search, distill) |
| `/team` | Team status and management |
| `/agents` | Manage persistent agent definitions |
| `/schedule` | Manage recurring team runs |
| `/rc` | Start browser remote control with QR code |
| `/sessions` | List and resume saved sessions |
| `/compact` | Compress conversation to save tokens |
| `/rewind [n]` | Undo last N turns |
| `/export` | Save conversation as markdown |
| `/context` | Show token usage breakdown |
| `/cost` | Show pricing breakdown |
| `/status` | Full system status |

## CLI Options

```
autocli [prompt]              One-shot query
autocli --resume [id]         Resume session (latest if no ID)
autocli --model <name>        Set model (sonnet/opus/haiku/local/minimax)
autocli --provider <name>     Set provider (anthropic/openai/claude-local/minimaxi-cn)
autocli --headless            Run as HTTP/WebSocket server
autocli --port <n>            Server port (default: 3456)
autocli --scheduler           Run as schedule daemon
autocli --run-team <name>     Execute a team template once
autocli --set-key <key>       Save API key to config
```

## Remote Control

Start a browser-accessible session from the terminal:

```
> /rc
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ QR CODE HERE █
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
  ✓ Remote control session started
  URL: https://router.eclaw.ai/rc#abc123
```

Scan the QR code or open the URL. The browser shows a live terminal where you can chat with the agent, see tool calls, and approve/deny actions.

## WebSocket API

Connect to `/ws` for real-time bidirectional control:

```js
const ws = new WebSocket('ws://localhost:3456/ws')

// Authenticate
ws.send(JSON.stringify({ type: 'auth', token: 'Bearer <jwt>' }))

// Chat
ws.send(JSON.stringify({ type: 'chat', message: 'fix the bug' }))

// Control
ws.send(JSON.stringify({ type: 'control', action: 'interrupt' }))
ws.send(JSON.stringify({ type: 'control', action: 'set_model', value: 'opus' }))
ws.send(JSON.stringify({ type: 'control', action: 'set_permission_mode', value: 'auto-approve' }))
```

Server streams back `text`, `tool_use`, `tool_result`, `done`, and `control_ack` messages.

## Configuration

`~/.autocli/config.json`:

```json
{
  "model": "claude-opus-4-6-20250616",
  "maxTokens": 8192,
  "permissionMode": "default",
  "provider": "anthropic",
  "hooks": [],
  "remotePort": 3456,
  "maxSessionCost": 5.00
}
```

## Project Structure

```
src/
├── index.ts              CLI entry point
├── repl.ts               Interactive REPL
├── engine/               Query engine + context management
├── commands/             All slash commands
├── tools/                Built-in tools (read, write, edit, bash, ...)
├── providers/            LLM providers (Anthropic, OpenAI, MinimaXI, local)
├── remote/               HTTP server, WebSocket, RC client
├── brain/                Second Brain (PARA knowledge store)
├── team/                 Multi-agent orchestration
├── agents/               Persistent agent definitions
├── scheduler/            Recurring task scheduling
├── session/              Session persistence
├── memory/               Cross-session memory
├── permissions/          Tool permission system
├── hooks/                Event-triggered shell commands
├── skills/               Reusable workflow loader
├── wire/                 Internal event bus
├── ui/                   Terminal UI (markdown, syntax, spinner, ...)
└── utils/                Config, platform, Zod-to-JSON
```

## Development

```bash
bun test              # 365 tests, ~500ms
bun run dev           # Watch mode
bun run typecheck     # Type check
```

## Tech Stack

[Bun](https://bun.sh) -- [TypeScript](https://www.typescriptlang.org) -- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) -- [Chalk](https://github.com/chalk/chalk) -- [Zod](https://zod.dev) -- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
