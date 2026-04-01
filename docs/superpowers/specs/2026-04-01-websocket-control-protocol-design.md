# WebSocket Transport & Control Protocol

**Date:** 2026-04-01
**Status:** Approved

## Summary

Add WebSocket transport to autocli's remote server, enabling real-time bidirectional communication for web dashboards and programmatic scripts. Add a control protocol for interrupting queries, switching models, changing permission modes, and adjusting max tokens.

## Goals

- Web dashboard and CLI scripts can connect via WebSocket for real-time streaming
- Clients can control session behavior (model, permissions, tokens) without restarting
- Clients can interrupt running queries
- Existing HTTP endpoints remain unchanged for backward compatibility

## Non-Goals

- Message buffering / event replay on reconnect (basic reconnection only)
- IDE bridge integration
- MCP server mode

## Architecture

### Connection Flow

1. Client connects to `ws://host:port/ws` (or with query param `?token=xxx`)
2. Client sends `{type: "auth", token: "Bearer xxx"}` as first message
3. Server verifies JWT or API key via existing `RemoteAuth`
4. On success: server sends `{type: "connected", sessionId: "abc123"}`
5. On failure: server closes with WebSocket code 4001

### Message Protocol

All messages are JSON objects with a `type` field.

#### Client → Server

| Type | Fields | Description |
|------|--------|-------------|
| `auth` | `token: string` | First message. Bearer JWT or ApiKey. |
| `chat` | `message: string, sessionId?: string, workingDir?: string` | Send a user message. Optional `sessionId` to resume an existing session. |
| `control` | `action: string, value?: string \| number` | Control command. See Control Protocol below. |
| `ping` | _(none)_ | Keep-alive ping. |

#### Server → Client

| Type | Fields | Description |
|------|--------|-------------|
| `connected` | `sessionId: string` | Auth succeeded, session created. |
| `text` | `text: string` | Streamed text chunk from LLM. |
| `tool_use` | `name: string, input: Record<string, unknown>` | Tool call started. |
| `tool_result` | `name: string, output: string, isError: boolean` | Tool call completed. |
| `done` | `sessionId: string, usage: {input: number, output: number, cost: string}` | Query completed. |
| `interrupted` | _(none)_ | Query was interrupted by client. |
| `error` | `message: string` | Error occurred. |
| `control_ack` | `action: string, success: boolean, value?: unknown, error?: string` | Response to a control command. |
| `pong` | _(none)_ | Response to ping. |

### Control Protocol

Four control actions, sent as `{type: "control", action: "...", value: ...}`:

| Action | Value | Effect | Timing |
|--------|-------|--------|--------|
| `interrupt` | _(none)_ | Aborts the running query via `AbortController.abort()` | Immediate — stops current query |
| `set_model` | `string` (model name or alias) | Updates engine config model + token counter pricing | Next query |
| `set_permission_mode` | `"default" \| "auto-approve" \| "deny-all"` | Updates `PermissionGate` mode | Immediate — next tool call uses new mode |
| `set_max_tokens` | `number` | Updates max output tokens in engine config | Next query |

Invalid values receive `{type: "control_ack", success: false, error: "..."}`.

### Concurrency

One chat query runs per session at a time. If a `chat` message arrives while a query is running, the server responds with `{type: "error", message: "Query already in progress. Send interrupt first."}`.

### Reconnection

Basic reconnection — client reconnects and re-authenticates. To resume conversation history, the client includes `sessionId` in the next `chat` message. No event replay or message buffering.

## File Structure

### New Files

- **`src/remote/wsProtocol.ts`** — TypeScript type definitions for all client→server and server→client message types. Validation helper to parse and type-check incoming messages.
- **`src/remote/wsHandler.ts`** — WebSocket connection handler class:
  - `onOpen(ws)` — initialize unauthenticated connection state
  - `onMessage(ws, message)` — parse JSON, route by type (auth, chat, control, ping)
  - `onClose(ws)` — clean up session, abort any running query
  - Auth verification via existing `RemoteAuth`
  - Chat handling: create `AbortController`, instantiate `QueryEngine` with streaming callbacks that send WS messages, track query-in-progress state
  - Control handling: validate action/value, mutate session state, send `control_ack`

### Modified Files

- **`src/remote/server.ts`** — Add `websocket` handler to `Bun.serve()` config, delegate to `WsHandler`. Add `server.upgrade(req)` for requests to `/ws` path.

### Test Files

- **`src/remote/wsProtocol.test.ts`** — Tests for message type validation/parsing
- **`src/remote/wsHandler.test.ts`** — Tests for:
  - Auth flow (valid JWT → connected, invalid → close 4001)
  - Chat flow (sends text/tool_use/tool_result/done events)
  - Control: interrupt aborts running query
  - Control: set_model updates config and token counter
  - Control: set_permission_mode updates permission gate
  - Control: set_max_tokens updates config
  - Control: invalid values return error ack
  - Concurrent chat rejection
  - Ping/pong
  - onClose cleanup

## Session State

Per-WebSocket-connection state managed by `WsHandler`:

```typescript
interface WsSession {
  id: string
  ws: ServerWebSocket<unknown>
  messages: Message[]
  abortController: AbortController | null  // null when idle
  engineConfig: QueryEngineConfig           // mutable for control commands
  tokenCounter: TokenCounter
  permissionGate: PermissionGate
  authenticated: boolean
}
```

Sessions are stored in a `Map<ServerWebSocket, WsSession>` inside `WsHandler`. When the WebSocket closes, the session is removed from the map. The `messages` array persists for the lifetime of the connection, enabling multi-turn conversation.

If a client reconnects with a `sessionId`, the handler looks up the session in the existing `RemoteServer.sessions` map to restore conversation history.

## Integration with Existing Code

- **RemoteAuth** — reused as-is for JWT/ApiKey verification
- **QueryEngine** — used per-query with `onText`, `onToolUse`, `onToolResult` callbacks wired to WS sends. `AbortSignal` from session's `AbortController` passed to `engine.run()`.
- **Wire** — not directly used by WS handler (the WS messages replace Wire for remote clients)
- **TokenCounter** — one per session, `updateModel()` called on `set_model`
- **PermissionGate** — one per session, `setMode()` called on `set_permission_mode`
- **resolveModel()** — used to resolve model aliases (e.g. "sonnet" → full model ID)

## Error Handling

- Malformed JSON → `{type: "error", message: "Invalid JSON"}`
- Unknown message type → `{type: "error", message: "Unknown message type: xyz"}`
- Auth required but not authenticated → close with code 4001
- QueryEngine throws → `{type: "error", message: "..."}` + query marked as not-in-progress
- WebSocket close during query → `AbortController.abort()` to clean up
