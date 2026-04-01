# Bugs Fixed

Date: 2026-04-01

## Fixed (Critical/High)

### Bug 1: AgentStore.loadAgent and loadTeam throw instead of returning null (HIGH) - FIXED
- **Files changed:** `src/agents/agentStore.ts`, `src/commands/agents.ts`
- **Fix:** Changed `loadAgent` and `loadTeam` to return `undefined` when not found or corrupted, instead of throwing. Updated callers in `agents.ts` to handle undefined.
- **Commit:** `fix: AgentStore.loadAgent and loadTeam return undefined instead of throwing`

### Bug 6: Compaction creates invalid message sequence violating API constraints (HIGH) - FIXED
- **File changed:** `src/engine/contextManager.ts`
- **Fix:** When `recentMessages[0]` has role `assistant`, the "Understood" filler assistant message is omitted to prevent consecutive assistant messages.
- **Commit:** `fix: compaction preserves message alternation and tool_use/tool_result pairs`

### Bug 8: SSRF bypass in WebFetch via DNS rebinding (HIGH) - FIXED
- **File changed:** `src/tools/webFetch.ts`
- **Fix:** After hostname string check, DNS is resolved and all resolved IPs are validated against the same internal range blocklist.
- **Commit:** `fix: prevent SSRF bypass via DNS rebinding in WebFetch`

### Bug 17: ContextManager.fitToContext drops messages without preserving tool_use/tool_result pairs (HIGH) - FIXED
- **File changed:** `src/engine/contextManager.ts`
- **Fix:** When building the result array, tool_use assistant messages and their corresponding tool_result user messages are now treated as atomic pairs during budget calculation.
- **Commit:** `fix: compaction preserves message alternation and tool_use/tool_result pairs` (combined with Bug 6)

### Bug 19: Bash tool's DENY_PATTERNS can be trivially bypassed (HIGH) - FIXED
- **File changed:** `src/tools/bash.ts`
- **Fix:** Added `\bbash\s+-c\b` and `\bsh\s+-c\b` patterns to DENY_PATTERNS to block shell -c invocations that could wrap dangerous commands.
- **Commit:** `fix: block bash -c and sh -c in Bash tool deny patterns`

## Skipped (Medium/Low - out of scope)

- Bug 2 (medium), Bug 3 (medium), Bug 4 (medium), Bug 5 (medium), Bug 7 (medium), Bug 9 (medium), Bug 10 (medium), Bug 11 (medium), Bug 12 (medium), Bug 13 (medium), Bug 14 (medium), Bug 15 (low), Bug 16 (medium), Bug 18 (medium), Bug 20 (medium), Bug 21 (low), Bug 22 (low/non-bug), Bug 23 (low), Bug 24 (low)
