# Social Media Launch Copy

---

## 1. LinkedIn Post

**Hook**: AI coding agents are writing faster code, but are they eroding your codebase's institutional memory?

Last week, we caught an AI coding assistant re-introducing an in-memory Redis cache on a user profile endpoint. The code was elegant and the tests passed.

The catch? We had intentionally removed that exact cache three months ago because stale data caused critical race conditions in customer billing.

The AI didn't make a syntax error. It suffered from **architectural amnesia**.

Every production codebase has hard-won rationale:
- Why certain modules remain synchronous
- Why an extension cannot touch payments APIs directly (PCI DSS boundary)
- Why specific database abstractions were rejected

When new developers or AI agents join the codebase, this context is missing. It lives in old Slack channels, closed PR reviews, or forgotten ADR directories.

To solve this, I built **Cogito**: an open-source tool and Model Context Protocol (MCP) server that acts as active institutional memory.

Here is how it works:
1. Architectural decisions are saved as structured, scoped Markdown files (`.decisions/active/`).
2. Fast local hooks monitor file modifications (<5ms).
3. The moment an agent (or human) touches governed code, an advisory context nudge is automatically surfaced.
4. Decisions stay in sync across Claude Code, Cursor, Copilot, and Windsurf.

No token bloat from dumping massive prompts on every turn. 100% local and private. Advisory, not blocking.

The project is fully open source (MIT):
🔗 GitHub: https://github.com/tarunagnihotri534/decision-memory
📦 npm: https://www.npmjs.com/package/cogito-cli

How is your engineering team preserving architectural context as AI agents write more of your code? I’d love to hear your thoughts below!

#SoftwareArchitecture #AIDevelopment #DevTools #ClaudeCode #CursorAI #OpenSource #ModelContextProtocol

---

## 2. X (Twitter) Thread (6 Posts)

### Post 1 (Hook)
Your AI coding agent writes great code. But it also keeps making the exact same architectural mistakes your team fixed 6 months ago.

Here’s why it happens — and the open-source tool we built to fix it: 🧵👇

### Post 2 (The Problem)
Last week, an agent re-added a cache we had explicitly deleted months ago because of billing race conditions.

Why? The AI had no way of knowing the *why*. 

Traditional ADRs in `docs/adr/` are passive and ignored. Stuffing 5,000 words into a system prompt inflates tokens and degrades model reasoning.

### Post 3 (The Solution)
Introducing **Cogito** (v0.1.0) 🧠

Institutional memory for your codebase. It captures architectural decisions as scoped Markdown files and surfaces them automatically the exact second matching files are touched.

[Attach GIF / image: docs/images/demo.gif]

### Post 4 (How it Works)
1. Record a decision with a glob pattern:
   `npx cogito record --summary "No payment APIs in extension" --scope "src/extension/**"`
2. Hook checks file edits in <5ms.
3. Relevant context is injected into Claude Code or your editor without polluting unrelated turns.

### Post 5 (Integrations & Features)
Built for the modern AI stack:
• Native Model Context Protocol (MCP) server
• Claude Code hooks & `/decide` command
• Auto-exports to `.cursorrules`, `.cursor/rules/*.mdc`, and `copilot-instructions.md`
• Built-in local web dashboard with supersession graph
• 100% local, 0 telemetry.

### Post 6 (Call to Action)
`cogito` is free & MIT licensed.

Try the 3-line quick start:
`npx cogito init`

⭐ Star on GitHub: https://github.com/tarunagnihotri534/decision-memory
📦 Install via npm: https://www.npmjs.com/package/cogito-cli

Feedback and PRs welcome! Let me know what you think.

---

## 3. Reddit Post (for r/ClaudeAI)

**Subreddit**: `r/ClaudeAI`  
**Title**: I built a tool to give Claude Code institutional memory so it stops re-introducing old architectural bugs

Hey everyone,

I've been using Claude Code daily since release. One problem I kept hitting across projects is what I call "architectural amnesia."

In our repo, we have areas of code with critical, non-obvious constraints:
- E.g., *"Do not expose payment endpoints to the browser extension API because of PCI DSS scope."*
- Or *"Keep the auth token module synchronous for backward compatibility with SDK v1."*

Claude doesn't know this historical context. During refactors, it would naturally suggest making things async or connecting the extension directly to payments because it seemed cleaner. If you put all these rules in `CLAUDE.md`, the file balloons to hundreds of lines and you burn tokens on every single prompt even when editing CSS.

To fix this, I created **Cogito**, an open-source CLI and MCP server:

### How it works:
1. **Scoped Storage**: Decisions are saved as lightweight Markdown files in `.decisions/active/` with glob scopes (e.g., `src/api/payments/**/*.ts`).
2. **PostToolUse Hook**: Runs automatically on `Write` and `Edit` tools. It checks the modified file path against active decision scopes in <5ms.
3. **Targeted Advisory**: If a match is found, an advisory context warning is surfaced to Claude immediately (`⚠️ 1 Architectural Decision matches this file...`). If no match, it exits silently.
4. **Slash Command & Auto-Capture**: You can type `/decide` in Claude Code to save decisions on the fly, or run `cogito propose` to extract decisions from previous transcripts.
5. **Dashboard & Multi-Agent**: Has a local React dashboard (`cogito dashboard`) and exports to Cursor (`.cursorrules` / `.mdc`), Copilot, and Windsurf.

It's completely local, MIT licensed, with 0 telemetry or external server calls.

Would love for you to test it out in your workflows!
GitHub: https://github.com/tarunagnihotri534/decision-memory
npm: https://www.npmjs.com/package/cogito-cli
