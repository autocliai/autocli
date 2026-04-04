# autocli CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a minimal CLI clone of autocliUI with all features, replacing TUI with simple readline/stdout.

**Architecture:** Copy services/stores/utils/tools verbatim. Rewrite CLI layer (ui/, repl.ts, some commands) to use readline and console.log instead of fullscreen TUI.

**Tech Stack:** Bun, TypeScript, chalk, marked, zod, SQLite

---

### Task 1: Project scaffold and copy verbatim files

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`
- Copy: `src/services/**`, `src/stores/**`, `src/utils/**`

- [ ] **Step 1:** Create package.json, tsconfig.json, .gitignore
- [ ] **Step 2:** Copy all services/, stores/, utils/ directories verbatim from autocliUI
- [ ] **Step 3:** Copy skills/ and teams/ directories
- [ ] **Step 4:** Run `bun install`

### Task 2: Rewrite CLI UI layer

**Files:**
- Create: `src/cli/ui/theme.ts` (copy as-is)
- Create: `src/cli/ui/input.ts` (readline-based)
- Create: `src/cli/ui/stream.ts` (simple stdout)
- Create: `src/cli/ui/prompt.ts` (Y/n and numbered prompts)
- Create: `src/cli/ui/markdown.ts` (marked terminal)
- Create: `src/cli/ui/spinner.ts` (simple text)
- Create: `src/cli/ui/syntaxHighlight.ts` (copy as-is)
- Create: `src/cli/ui/diff.ts` (copy as-is)
- Create: `src/cli/ui/errorFormat.ts` (copy as-is)
- Create: `src/cli/ui/history.ts` (copy as-is)
- Create: `src/cli/ui/progressBar.ts` (simple text)
- Create: `src/cli/ui/search.ts` (copy as-is)
- Create: `src/cli/ui/toolResult.ts` (copy as-is)
- Remove: fullscreen.ts, fuzzyPicker.ts, dialog.ts, vim.ts, statusLine.ts, swarmDisplay.ts

- [ ] **Step 1:** Copy unchanged UI files (theme, syntaxHighlight, diff, errorFormat, history, search, toolResult)
- [ ] **Step 2:** Write new input.ts using Bun readline
- [ ] **Step 3:** Write new stream.ts (simple stdout writer)
- [ ] **Step 4:** Write new prompt.ts (Y/n and numbered-list prompts)
- [ ] **Step 5:** Write new spinner.ts (simple stderr dots)
- [ ] **Step 6:** Write new progressBar.ts (text-based)
- [ ] **Step 7:** Write new permissionPrompt.ts (readline Y/n)
- [ ] **Step 8:** Write streamMarkdown.ts (copy as-is)

### Task 3: Copy and adapt commands

**Files:**
- Copy: all `src/cli/commands/*.ts`
- Modify: commands that reference dialog/fuzzyPicker/fullscreen

- [ ] **Step 1:** Copy types.ts, registry.ts verbatim
- [ ] **Step 2:** Copy all command files, adapting any that import from removed UI modules
- [ ] **Step 3:** Update clear.ts to use new prompt instead of showConfirm dialog
- [ ] **Step 4:** Update sessions.ts to use numbered list instead of fuzzyPicker

### Task 4: Rewrite repl.ts

**Files:**
- Create: `src/repl.ts` (readline-based REPL)

- [ ] **Step 1:** Write repl.ts using readline instead of fullscreen layout
- [ ] **Step 2:** Replace layout.log with console.log
- [ ] **Step 3:** Replace layout.writeOutput with process.stdout.write
- [ ] **Step 4:** Replace layout spinner with simple text spinner

### Task 5: Adapt index.ts

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1:** Copy index.ts, remove fullscreen imports, update permissionPrompt import

### Task 6: Verify and test

- [ ] **Step 1:** Run `bun run typecheck`
- [ ] **Step 2:** Fix any type errors
- [ ] **Step 3:** Run `bun src/index.ts --help` to verify startup
- [ ] **Step 4:** Run `bun test` if tests exist
