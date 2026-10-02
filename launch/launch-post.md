# Why Your AI Coding Agent Keeps Making the Same Architectural Mistake (And How We Fixed It)

*Published by Tarun Agnihotri · 6 min read*

---

Last week, during what was supposed to be a routine refactor of our API routing layer, an AI coding agent did something that seemed completely logical on the surface — and terrifying underneath.

It re-introduced an in-memory Redis caching layer to our user profile endpoint (`/api/v1/users/:id/profile`).

The agent wrote clean code. The unit tests passed. The PR looked flawless. The problem? **We had explicitly ripped that exact cache out three months ago because stale user profile data caused race conditions and triggered dozens of customer support escalations.**

When we asked the agent why it added the cache, its reasoning was textbook: *"User profiles are read-heavy, so caching improves latency and database throughput."*

It wasn't wrong from a generic software engineering standpoint. What the agent lacked wasn't intelligence — **it lacked institutional memory**.

---

## The Silent Problem in AI-Assisted Codebases

Every production codebase accumulates architectural decisions that cannot be inferred simply by reading the raw syntax:
- Why the payment module is strictly synchronous.
- Why our browser extension cannot invoke internal microservice APIs directly (PCI DSS compliance boundary).
- Why we deliberately avoid certain ORM abstractions in specific database queries.

When humans work together in an office, this context gets passed down over coffee or in PR reviews. But in the era of AI agents like Claude Code, Cursor, Copilot, and Windsurf, every new session starts with a blank slate. 

Unless you stuff your entire company history into an 8,000-line prompt (blowing up token costs and diluting attention), the AI will inevitably re-introduce the very patterns you fought hard to eradicate.

We tried storing this context in Notion. The AI never read it.  
We tried storing Architecture Decision Records (ADRs) in `docs/adr/`. They rotted within weeks.  
We tried putting comments at the top of files. Developers deleted them during refactors.

So we built **[decision-tracker](https://github.com/tarunagnihotri534/decision-memory)**.

---

## What is decision-tracker?

`cogito` is an open-source CLI and Model Context Protocol (MCP) server that acts as an **always-on institutional memory** for your codebase.

Instead of passive docs, `cogito` stores architectural choices as structured, scoped Markdown files in `.decisions/` and **surfaces them at the precise second a matching file is touched**.

[INSERT SCREENSHOT: Terminal showing advisory alert when checkout.ts is edited]

### How it works: Zero Token Bloat

Unlike static rule files that dump hundreds of guidelines into every turn, `cogito` uses fast (<5ms) glob matching:

1. You record an architectural constraint with a target scope:
   ```bash
   npx cogito record \
     --summary "Do not expose payment APIs to browser extension" \
     --rationale "Extension context has weaker isolation; brings extension into PCI scope" \
     --scope "src/api/payments/**/*.ts,src/extension/**/*.ts" \
     --tags "security,payments"
   ```

2. When you or Claude Code edit `src/extension/api/client.ts`, the `PostToolUse` hook intercepts the edit.

3. An advisory nudge is injected directly into the conversation context:
   ```
   ⚠️ 1 Architectural Decision(s) match 'src/extension/api/client.ts':
   --------------------------------------------------
   ID:        dec_20261001_97rs07
   Summary:   Do not expose payment APIs to browser extension
   Rationale: Extension context has weaker isolation; brings extension into PCI scope
   Scope:     src/api/payments/**/*.ts, src/extension/**/*.ts
   --------------------------------------------------
   ```

It's **advisory, not blocking**. It doesn't break builds or prevent urgent hotfixes. It simply gives the AI (and human developers) the context they need to make the right choice *before* the PR is opened.

---

## Concrete Example: Before & After

### The Scenario: User Profile Caching
- File: `src/api/users/profile.ts`
- Historical Problem: Cache invalidation failures during subscription upgrades caused users to see locked dashboards after paying.

### 🔴 Before decision-tracker
- Developer or AI prompts: *"Optimize latency on user profile endpoints."*
- AI sees a standard database query and writes:
  ```typescript
  // AI adds caching without knowing why it was removed
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  ```
- Result: Race condition resurrected; regressions in production.

### 🟢 With decision-tracker
- Decision `dec_no_profile_caching` is active on scope `src/api/users/**/*.ts`.
- AI attempts to modify `src/api/users/profile.ts`.
- Hook triggers: *"⚠️ Active Decision: Do not cache user profiles due to billing state race conditions."*
- AI immediately pivots: *"I see that caching is prohibited on this endpoint due to billing race conditions. Instead, I will optimize the SQL query and add a composite index on `(user_id, status)`."*
- Result: 0 regressions, faster queries, architectural constraints respected.

---

## Quick Setup (Under 2 Minutes)

`cogito` requires Node 20+ and works with your existing tools without lock-in.

### 1. Initialize your project
```bash
npx cogito init
```
This scaffolds `.decisions/`, installs Claude Code hooks, and configures `.claude/settings.json`.

### 2. Connect to Your AI Tool

#### For Claude Code (CLI)
It's already configured! The hook triggers automatically on `Write` and `Edit` tool calls.

#### For Cursor, Windsurf, or Copilot
Export your decisions into your editor's native rule format:
```bash
npx cogito export --target all
```
This automatically updates managed sections in `.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, and `.github/copilot-instructions.md`.

#### For MCP Clients (Claude Desktop, Roo Code, etc.)
Add to your MCP configuration:
```json
{
  "mcpServers": {
    "decision-tracker": {
      "command": "npx",
      "args": ["-y", "decision-tracker", "server"]
    }
  }
}
```

### 3. Visual Web Dashboard
Prefer a visual view? Run:
```bash
npx cogito dashboard
```
This opens a local React dashboard where you can browse the supersession timeline graph, search decisions with relevance ranking, and run health diagnostics on your decision scopes.

[INSERT SCREENSHOT: Visual Web Dashboard showing decision graph and timeline]

---

## Honest Limitations

We want to be upfront about what `cogito` does and does not do:

1. **It's only as good as what you record**: If an architectural choice is kept purely in someone's head and never recorded, no tool can guess it. However, `cogito propose` can scan your AI session transcripts and suggest candidate decisions for you to approve in one keystroke.
2. **File-level and glob-level granularity**: Scopes match on file paths and glob patterns. It does not perform semantic AST function-level boundaries (though our opt-in import matcher helps detect dependencies).
3. **Advisory by design**: By default, it will not prevent git commits unless you explicitly install our pre-commit hook (`cogito export --install-pre-commit`). We believe developer tools should empower, not get in the way.

---

## Try it Out & Get Involved

`cogito` is 100% open source under the MIT License. Nothing leaves your machine — no telemetry, no clouds, no tracking.

- **GitHub Repository**: [tarunagnihotri534/decision-memory](https://github.com/tarunagnihotri534/decision-memory)
- **npm Package**: [decision-tracker](https://www.npmjs.com/package/cogito-cli)
- **Release Version**: `0.1.0`

If you're building with AI coding agents and tired of repeating yourself across sessions, give it a star, test it in your repo, and share your feedback!
