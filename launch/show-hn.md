# Show HN Submission & Discussion Assets

---

## 1. Post Title (68 characters)

```
Show HN: Decision-Tracker – Institutional memory for AI coding agents
```

---

## 2. Author's First Comment

Hey HN! I'm Tarun, the creator of `cogito`.

Like many of you, I've been doing a significant amount of coding with AI agents (Claude Code, Cursor, Copilot). While the productivity boost is incredible, I kept running into a frustrating recurring problem: **agent architectural amnesia**.

In any mature codebase, you have non-obvious architectural choices that aren't apparent from the code syntax:
- Why an authentication flow is synchronous to support legacy SDK consumers.
- Why our browser extension cannot invoke payments APIs directly (PCI DSS boundary).
- Why we intentionally ripped out caching on a user profile endpoint after race conditions caused support escalations.

Human developers eventually internalize this context, but AI agents start every new prompt or session with zero institutional memory. In our repos, agents kept re-introducing caching, connecting restricted endpoints, or refactoring intentional trade-offs — simply because the *why* lived in old Slack threads or closed PRs.

Dumping an 8,000-line prompt into every session wastes context tokens and degrades model reasoning. Traditional ADRs in `docs/adr/` rot because nobody reads them during an active editing loop.

I built `cogito` to solve this locally:
1. **Scoped Capture**: Decisions are saved as lightweight Markdown files with glob scopes (e.g. `src/api/payments/**/*.ts`).
2. **Zero-Latency Advisories**: A fast (<5ms) glob hook intercepts file edits and injects an advisory warning *only* when the agent touches a matching file. Zero prompt bloat when editing unrelated code.
3. **Multi-Agent Sync**: You can export decisions directly into `.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, or GitHub Copilot instructions with managed markers.
4. **Lifecycle Tracking**: Decisions can be superseded or archived with full history traversal (`active` -> `superseded` -> `archived`).
5. **Local First & Private**: 100% runs on your machine. No telemetry, no remote API calls, no third-party accounts.

It also includes an MCP server (with tools like `record_decision`, `check_file_decisions`, and `run_doctor`) and a local React web dashboard for browsing the dependency graph.

- GitHub: https://github.com/tarunagnihotri534/decision-memory
- npm: https://www.npmjs.com/package/cogito-cli
- License: MIT

I'd love to hear your thoughts, how you handle architectural context in AI workflows, and what integrations you'd like to see next!

---

## 3. Top 5 Likely Questions & Honest Answers

### Q1: Why not just use existing ADR tools (like `adr-tools` or Markdown files in `docs/adr/`)?
**Answer**:
We love ADRs, and in fact `cogito` includes an `import --format adr` command to ingest existing ADRs. But the fundamental flaw of traditional ADRs is that they are **passive**. They sit in a directory waiting for someone to remember to read them. When an AI agent or a developer edits `src/auth/jwt.ts`, nobody stops to search through 80 ADR files. `cogito` turns ADRs into **active runtime context** by binding decisions to glob scopes that trigger automatically when affected files are modified.

### Q2: How is this different from putting rules into `.cursorrules` or `CLAUDE.md`?
**Answer**:
Token cost and signal-to-noise ratio. If you dump all your project's architectural rationale into a single `.cursorrules` or system prompt, every single turn sends hundreds of lines of text to the model, even when editing a CSS file or button component. This wastes tokens and dilutes the model's attention. `cogito` is **scoped**: context is only surfaced when you edit code that matches the decision's glob pattern. Plus, `cogito` actually exports cleanly to `.cursorrules` and `.cursor/rules/*.mdc` if you want it to manage those rules for you!

### Q3: Won't these advisory hooks slow down AI coding sessions or human developers?
**Answer**:
No. The scope matching is done via local glob compilation (`minimatch`) with an in-memory index. Benchmark execution time is under 5ms per file check. For Claude Code, it runs in a background `PostToolUse` hook and prints a concise 3-line warning. If no decisions match the modified file, it exits with code 0 silently without printing anything.

### Q4: What happens when an architectural decision becomes obsolete?
**Answer**:
Codebases evolve, and permanent decisions are an anti-pattern. `cogito` provides first-class lifecycle states: `active`, `superseded`, and `archived`. You can run `cogito supersede <old-id> --summary "New architecture"` or update it via the MCP server. Older decisions maintain a bidirectional link to their replacement, and our `cogito doctor` command alerts you if glob scopes match 0 files in your repository.

### Q5: Can the AI record decisions automatically, or does a human have to write everything?
**Answer**:
Both modes are supported. During a conversation, Claude Code can call the `record_decision` MCP tool directly when an architectural choice is finalized. We also built `cogito propose`, which scans conversation transcripts for consensus statements and puts candidate decisions into a staging inbox (`.decisions/.inbox/`) where you can review, approve, or reject them with a single keystroke.
