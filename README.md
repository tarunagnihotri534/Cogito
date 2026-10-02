# Cogito

[![npm version](https://img.shields.io/npm/v/cogito-cli.svg?color=indigo)](https://www.npmjs.com/package/cogito-cli)
[![CI / Release](https://github.com/tarunagnihotri534/decision-memory/actions/workflows/release.yml/badge.svg)](https://github.com/tarunagnihotri534/decision-memory/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm provenance](https://img.shields.io/badge/provenance-verified-brightgreen.svg)](https://www.npmjs.com/package/cogito-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-success.svg)](https://nodejs.org)

```bash
# 3-line quick start
npx cogito init
npx cogito record --summary "Do not expose payment APIs to extension" --rationale "PCI scope" --scope "src/extension/**/*.ts"
npx cogito check src/extension/api/client.ts
```

<p align="center">
  <img src="https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/images/demo.gif" alt="decision-tracker demo" width="100%" />
</p>

Institutional memory for your codebase. Captures the *why* behind architectural decisions and surfaces them automatically when matching files are edited.

Every codebase accumulates architectural choices that aren't obvious from reading the raw source code. Why the authentication module is synchronous. Why the browser extension cannot invoke the payments API directly. Why caching was intentionally disabled on the user profile endpoint. These choices have critical rationale — domain constraints, security boundaries, trade-offs, and lessons learned — but that context usually lives in forgotten chat logs, PR review threads, or developer memories.

When a new developer (or an AI assistant like Claude Code or Copilot) works in that area later, they lack this historical context. They re-introduce caching. They attempt to connect the extension directly to payments. They make the exact same mistakes because the *why* was never persisted alongside the codebase.

**Cogito** captures these decisions as structured, scoped Markdown files and surfaces them at the precise moment they matter — when you or your AI agent modify affected code:

- *"We chose not to expose payment endpoints to the browser extension because of PCI DSS compliance scope implications."*
- *"Kept the auth module synchronous to preserve backward compatibility with existing SDK v1 consumers."*
- *"Went with server-side rendering for the dashboard to avoid exposing sensitive analytics API credentials to the client."*
- *"Decided against caching user profiles because data updates frequently and stale data triggered support escalations."*

It's advisory, not blocking. A helpful nudge that says: *"Hey, this area of the codebase has established architectural context you should know before making changes."* You can always supersede or update a decision when requirements evolve.

---

## How it works

### Recording a decision

When an architectural choice is made during a coding session, it gets captured and stored as a scoped, queryable markdown file.

<p align="center">
  <img src="https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/images/recording-a-decision.svg" alt="Recording a decision" width="100%" />
</p>

<details>
<summary>View Mermaid source</summary>

[docs/diagrams/recording-a-decision.mmd](https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/diagrams/recording-a-decision.mmd)

</details>

### Surfacing at the right moment

When code is edited — by a human developer or an AI assistant — relevant decisions are automatically surfaced as advisory context.

<p align="center">
  <img src="https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/images/surfacing-at-the-right-moment.svg" alt="Surfacing at the right moment" width="100%" />
</p>

<details>
<summary>View Mermaid source</summary>

[docs/diagrams/surfacing-at-the-right-moment.mmd](https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/diagrams/surfacing-at-the-right-moment.mmd)

</details>

### Lifecycle of a decision

Decisions aren't permanent — they evolve as project requirements change.

<p align="center">
  <img src="https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/images/lifecycle-of-a-decision.svg" alt="Lifecycle of a decision" width="100%" />
</p>

<details>
<summary>View Mermaid source</summary>

[docs/diagrams/lifecycle-of-a-decision.mmd](https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/diagrams/lifecycle-of-a-decision.mmd)

</details>

### Where it fits in your workflow

<p align="center">
  <img src="https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/images/workflow-fit.svg" alt="Where it fits in your workflow" width="100%" />
</p>

<details>
<summary>View Mermaid source</summary>

[docs/diagrams/workflow-fit.mmd](https://raw.githubusercontent.com/tarunagnihotri534/decision-memory/main/docs/diagrams/workflow-fit.mmd)

</details>

---

## Quick start

### Install

```bash
npm install -g cogito-cli
```

Or use directly without global installation:

```bash
npx cogito init
```

### Initialize in your project

```bash
cd your-project
cogito init
```

This creates:
```
.decisions/
├── active/          # Currently active decisions
├── superseded/      # Replaced by newer decisions
├── archived/        # No longer relevant
└── index.json       # Auto-generated index cache for fast glob queries
```

### Record your first decision

```bash
cogito record \
  --summary "Use Zod for all runtime validation" \
  --rationale "Type-safe, composable, works seamlessly with TS type inference" \
  --scope "src/**/*.ts,api/**/*.ts" \
  --tags "validation,schema" \
  --author "tarunagnihotri"
```

### Check decisions for a file

```bash
cogito check src/api/users.ts
```

Output:
```text
⚠️  1 Architectural Decision(s) match 'src/api/users.ts':

--------------------------------------------------
ID:        dec_20260728_x8k2p9
Summary:   Use Zod for all runtime validation
Rationale: Type-safe, composable, works seamlessly with TS type inference
Scope:     src/**/*.ts, api/**/*.ts
Tags:      validation, schema
Author:    tarunagnihotri
--------------------------------------------------
```

---

## Web dashboard

`cogito` includes a local React + Tailwind CSS dashboard for inspecting, searching, and managing decisions visually alongside the CLI and MCP server workflows.

```bash
cogito dashboard --port 3333
```

- **Interactive Table & Grid**: Filter decisions by status (`active`, `superseded`, `archived`) and tag sets.
- **Scope Tester Tool**: Enter any file path to test glob matchers interactively.
- **Visual Record Form**: Submit new decisions directly from the browser UI.

---

## Integration with Claude Code

`cogito` integrates natively with Claude Code as an **MCP server** (so Claude can record and query decisions) and as a **PostToolUse hook** (so Claude is automatically warned about relevant decisions when editing files).

### 1. MCP Server setup

Add `cogito` to your Claude Code MCP configuration (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "decision-tracker": {
      "command": "npx",
      "args": ["-y", "decision-tracker", "serve"]
    }
  }
}
```

This exposes 4 tools to Claude Code:

| Tool | Description |
|------|-------------|
| `query_decisions` | Find active decisions relevant to a file path or tag list |
| `record_decision` | Record a new architectural decision |
| `list_decisions` | List all decisions, filterable by status or tags |
| `get_decision` | Fetch full details of a specific decision by ID |

Claude automatically invokes `query_decisions` when analyzing architecture, and `record_decision` when technical choices are made.

### 2. PostToolUse hook setup

`cogito init` automatically creates `.claude/hooks/check-decisions.sh` and configures `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": ".claude/hooks/check-decisions.sh"
      }
    ]
  }
}
```

The hook runs after every `Write` or `Edit` tool call. If the file being edited matches active decision glob scopes, Claude receives an advisory system message:

> **Advisory:** 1 existing architectural decision(s) apply to this file:
> - Use Zod for all runtime validation (scope: `src/**/*.ts`) [ID: `dec_20260728_x8k2p9`]
>
> These are advisory — you may proceed, but consider whether your changes align with these decisions.

### 3. `/decide` slash command

`cogito init` copies a custom slash command to `.claude/commands/decide.md`. Run it during a conversation:

```text
/decide
```

Claude will review the conversation, extract any architectural decisions that were made, and execute `record_decision` for each one.

---

## Integration with GitHub Copilot CLI & Git

GitHub Copilot CLI (`gh copilot`) and Git workflows can incorporate `cogito` via shell scripts and Git hooks.

### 1. Pre-check before asking Copilot

Check governing decisions before requesting edits from Copilot:

```bash
cogito check src/api/auth.ts
gh copilot suggest "add OAuth support to src/api/auth.ts"
```

### 2. Shell alias for Copilot-aware editing

Add to your `.bashrc` or `.zshrc`:

```bash
copilot-edit() {
  local file="$1"
  shift

  local decisions
  decisions=$(cogito check "$file" 2>/dev/null)
  if [ -n "$decisions" ] && ! echo "$decisions" | grep -q "No decisions"; then
    echo "--- Relevant Decisions ---"
    echo "$decisions"
    echo "---"
  fi

  gh copilot suggest "$@"
}
```

### 3. Git pre-commit hook

Add decision awareness to your git workflow by creating `.git/hooks/pre-commit`:

```bash
#!/usr/bin/env bash
CHANGED_FILES=$(git diff --cached --name-only)
WARNINGS=""

for file in $CHANGED_FILES; do
  result=$(cogito check "$file" --json 2>/dev/null || echo "[]")
  count=$(echo "$result" | node -e 'console.log(JSON.parse(fs.readFileSync(0)).length)' 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    WARNINGS="${WARNINGS}\n  - ${file}"
  fi
done

if [ -n "$WARNINGS" ]; then
  echo "🧠 Decision Tracker: The following staged files match active architectural decisions:"
  echo -e "$WARNINGS"
  echo "Review with: cogito check <file>"
fi
```

### 4. GitHub Actions for PR review

Add `.github/workflows/decision-check.yml` to automatically comment on pull requests when changed files match decision scopes:

```yaml
name: Decision Check
on: [pull_request]

jobs:
  check-decisions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g cogito-cli

      - name: Check changed files against decisions
        run: |
          node -e '
            const execSync = require("child_process").execSync;
            const files = execSync("git diff --name-only origin/${{ github.base_ref }}...HEAD", { encoding: "utf-8" }).split("\n").filter(Boolean);
            for (const file of files) {
              const res = execSync(`cogito check "${file}" --json`, { encoding: "utf-8" });
              console.log(file, res);
            }
          '
```

---

## Integration with any AI agent

`cogito` is designed to work with any AI coding agent. The general pattern:

1. **Before Editing**: Call `cogito check <file> --json` to retrieve matching decision records.
2. **Prompt Injection**: Include the retrieved rationale and constraints in your agent's system prompt or context window.
3. **After Decisions Are Made**: Call `cogito record` (or invoke the MCP server tool) to log new decisions.

---

## Decision file format

Each decision is stored as a standard Markdown file with YAML frontmatter:

```markdown
---
id: dec_20260728_x8k2p9
summary: Do not expose payment endpoints to browser extension API
rationale: Browser extension context has weaker isolation; exposing payment APIs would bring the extension into PCI DSS scope
scope:
  - "src/api/payments/**/*.ts"
  - "src/extension/**/*.ts"
tags:
  - security
  - payments
  - extension
author: tarunagnihotri
confidence: explicit
status: active
created: 2026-07-28T15:00:00Z
---

# Do not expose payment endpoints to browser extension API

## Rationale
Browser extension context has weaker isolation; exposing payment APIs would bring the extension into PCI DSS scope.

## Context
During the browser extension build-out, we considered letting the extension call the payments API directly. After reviewing PCI DSS requirements, we determined that exposing payment endpoints to the extension would require the extension to be in scope for PCI compliance.

## Consequences
The extension must go through the main web app for any payment-related actions. No payment types, schemas, or API clients should be imported in the extension codebase.
```

### Frontmatter fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID (`dec_YYYYMMDD_<nanoid>`) |
| `summary` | string | One-line summary of the decision |
| `rationale` | string | Rationale explaining why this choice was made |
| `scope` | string[] | Array of glob patterns for governed files |
| `tags` | string[] | Array of categorization tags |
| `author` | string | Author or recorder of the decision |
| `confidence` | enum | `explicit` (stated), `inferred` (detected), or `suggested` |
| `status` | enum | `active`, `superseded`, or `archived` |
| `created` | ISO 8601 | ISO timestamp when recorded |
| `context` | string | Optional background context |
| `consequences` | string | Optional consequences & trade-offs |
| `supersededBy` | string | ID of replacing decision (optional) |

### Body sections

- **Rationale**: Core technical explanation for the decision.
- **Context**: Historical background and conditions under which the decision was made.
- **Consequences**: Downstream impacts, constraints, and prohibited patterns.

### Index file

`.decisions/index.json` is auto-generated for fast file-to-decision lookups:

```json
[
  {
    "id": "dec_20260728_x8k2p9",
    "summary": "Do not expose payment endpoints to browser extension API",
    "rationale": "Browser extension context has weaker isolation...",
    "scope": ["src/api/payments/**/*.ts", "src/extension/**/*.ts"],
    "tags": ["security", "payments", "extension"],
    "author": "tarunagnihotri",
    "status": "active",
    "confidence": "explicit",
    "created": "2026-07-28T15:00:00Z",
    "filePath": ".decisions/active/dec_20260728_x8k2p9.md"
  }
]
```

---

## CLI reference

### `cogito init`

Initialize decision tracking in the current repository. Creates the `.decisions/` directory structure, copies the hook script to `.claude/hooks/`, and installs the `/decide` slash command to `.claude/commands/`.

### `cogito record`

Record a new decision from the command line interface.

```bash
cogito record \
  --summary "Use PostgreSQL for persistence" \
  --rationale "ACID compliance, JSON support, mature ecosystem" \
  --scope "src/db/**/*.ts,src/models/**/*.ts" \
  --tags "database,persistence" \
  --author "tarunagnihotri" \
  --confidence explicit \
  --context "Evaluated SQLite, MySQL, and PostgreSQL" \
  --consequences "All persistence operations must go through pg driver"
```

**Options:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `-s, --summary` | Yes | — | One-line decision summary |
| `-r, --rationale` | Yes | — | Rationale behind the decision |
| `-c, --scope` | Yes | — | Comma-separated or space-separated glob patterns |
| `-t, --tags` | No | `[]` | Categorization tags |
| `-a, --author` | No | `anonymous` | Author name or handle |
| `--confidence` | No | `explicit` | `explicit`, `inferred`, or `suggested` |
| `--context` | No | — | Additional background context |
| `--consequences` | No | — | Expected consequences or trade-offs |
| `--supersedes` | No | — | ID of an old decision superseded by this one |
| `--review-by` | No | — | Scheduled review date in ISO format (`YYYY-MM-DD`) |

### `cogito check <file>`

Query active decisions governing a specific file path.

```bash
cogito check src/api/users.ts
cogito check src/api/users.ts --json   # JSON output format
```

### `cogito list`

List recorded decisions with optional status and tag filters.

```bash
cogito list
cogito list --status active
cogito list --tags validation,schema
cogito list --json
```

### `decision-tracker get <id>`

Retrieve full decision details and Markdown document by ID.

```bash
decision-tracker get dec_20260728_x8k2p9
decision-tracker get dec_20260728_x8k2p9 --json
```

### `cogito import`

Import architectural decisions from existing ADR repositories (supports MADR and Nygard formats, e.g. `docs/adr/`).

Features:
- **Status mapping**: Maps ADR statuses (`accepted`, `approved`, `draft`, `deprecated`, `superseded`, etc.) to `active`, `superseded`, or `archived`.
- **Scope inference**: Scans ADR text for governed code paths (e.g. `src/api/auth.ts`, `src/db/`). If no scope can be inferred, imports with tag `needs-scope` and reports it. Use `--default-scope <glob>` to supply an explicit fallback.
- **Idempotency**: Computes source content SHA-256 hashes and writes `source: { type: "adr", path: "...", hash: "..." }` frontmatter to prevent duplicate imports on subsequent runs.
- **Two-pass supersession resolution**: Automatically links superseded decisions to their superseding decisions by filename, number, or title reference.
- **Dry-run mode**: Preview imports without modifying storage using `--dry-run`.
- **JSON mode**: Structured machine-readable output with `--json`.

```bash
# Dry run preview of ADR import
cogito import --from adr docs/adr --dry-run

# Import ADRs into .decisions/
cogito import --from adr docs/adr

# Import with explicit default scope fallback and JSON output
cogito import --from adr docs/adr --default-scope "src/**/*" --json
```


### `cogito export`

Export architectural decisions to configuration and rule files for AI coding agents (Cursor, AGENTS.md, GitHub Copilot, Windsurf).

```bash
# Export to all supported AI agent targets
cogito export

# Export to a specific target
cogito export --target cursor
cogito export --target agents-md
cogito export --target copilot
cogito export --target windsurf

# Check if agent files are in sync (exits 1 if out of sync, perfect for CI)
cogito export --check

# Watch .decisions/ directory and continuously re-export on changes
cogito export --watch

# Install pre-commit hook (detects Husky, core.hooksPath, or .git/hooks)
cogito export --install-pre-commit

# Output results as JSON
cogito export --json
```

**Target specifications:**

| Target | Destination | Description |
|---|---|---|
| `cursor` | `.cursor/rules/<slug>.mdc` | One rule per active decision with YAML frontmatter (`description`, `globs`, `alwaysApply: false`). Automatically removes stale rules when decisions are superseded or archived. |
| `agents-md` | `AGENTS.md` | Size-capped, scope-annotated managed section bounded by `<!-- BEGIN:decision-tracker -->` and `<!-- END:decision-tracker -->`. |
| `copilot` | `.github/copilot-instructions.md` | Size-capped managed section for GitHub Copilot. |
| `windsurf` | `.windsurfrules` or `.windsurf/rules/decisions.md` | Managed section for Windsurf AI / Cascade. |
| `all` | All of the above | Default target. |

**Key features:**
- **Deterministic output**: Always sorts active decisions consistently by creation date and ID.
- **Size-capped & scope-annotated**: Preserves token budget with compact summaries, truncated rationale thresholds, and explicit glob scopes.
- **Marker integrity**: Throws descriptive errors if managed markers are unbalanced, duplicated, or inverted. Preserves existing CRLF / LF line endings.
- **Atomic file writes**: Writes to temporary files before replacing targets to prevent partial corruption.
- **Pre-commit integration**: Installs a non-destructive hook check into Husky, Git hooks path, or standard `.git/hooks/pre-commit`.


### `cogito propose`

Extract candidate architectural decisions from a session transcript file into the local inbox (`.decisions/.inbox/`).

```bash
# Extract decision candidates from a Claude Code JSONL transcript
cogito propose --transcript ~/.claude/transcripts/session-123.jsonl

# Extract with a custom max candidate limit and JSON output
cogito propose --transcript session.jsonl --max 3 --json
```

**Features:**
- **Signal scoring**: Scores candidates from 0.0 to 1.0 based on decision verbs, rationale depth, comparative reasoning, and affected file scopes.
- **Deduplication**: Automatically deduplicates candidates against existing active decisions in `.decisions/` and within the session.
- **Capped storage**: Limits extraction to the top 5 highest-confidence candidates per session.
- **Gitignored inbox**: Stores proposals in `.decisions/.inbox/`, which is automatically added to `.gitignore` so unreviewed proposals remain local.

### `cogito review`

Interactive or automated review of candidate decisions saved in `.decisions/.inbox/`.

```bash
# Interactive review (TTY): approve [a], edit [e], reject [r], skip [s], or quit [q]
cogito review

# Non-interactive: auto-approve high-confidence candidates (score >= 0.75)
cogito review --yes

# Non-interactive with custom minimum score threshold
cogito review --yes --min-score 0.85

# List pending inbox proposals without prompting
cogito review --list

# Output inbox proposals as JSON
cogito review --json
```

### `cogito hook <event>`

Cross-platform lifecycle hook handler designed for AI agents like Claude Code. Configured in `.claude/settings.json` or called directly.

```bash
# PostToolUse: checks matching decisions when files are edited and returns advisory context
cogito hook post-tool-use < hook-input.json

# SessionEnd: automatically captures candidate decisions to .decisions/.inbox/ silently
cogito hook session-end < hook-input.json
```


### `cogito doctor`

Diagnose the health and freshness of repository architectural decisions. Checks for dead globs (matching 0 files), heavily changed files (code churn since decision creation via git log), expired `reviewBy` dates, and broken `supersededBy` links.

```bash
# Run diagnostics (exits with code 0)
cogito doctor

# Strict mode: exits with code 1 if any warnings or errors are found (for CI/CD)
cogito doctor --strict

# Output diagnostic report as JSON
cogito doctor --json
```

### `cogito lint`

Validate all decision markdown files in `.decisions/` against schema definitions and directory alignment.

```bash
# Lint decision files
cogito lint

# Output lint issues as JSON
cogito lint --json
```

A standard JSON Schema is published at [`schema/decision.schema.json`](schema/decision.schema.json) for IDE autocompletion and schema validation.

### `cogito reindex`

Rebuild `.decisions/index.json` from scratch by re-scanning all Markdown files in `.decisions/(active|superseded|archived)/`.

```bash
# Rebuild decision cache index
cogito reindex

# Reindex and output JSON summary
cogito reindex --json
```

### `cogito why <file>`

Get a clear, human-readable explanation of why specific architectural decisions govern a target file, including historical rationale, context, and constraints.

```bash
# Explain why decisions apply to a file
cogito why src/auth/session.ts

# Output explanation as JSON
cogito why src/auth/session.ts --json
```

### `cogito log <id>`

Visualize the supersession history and evolution of an architectural decision from its origin to its current state.

```bash
# View supersession evolution timeline
cogito log dec_20260728_x8k2p9

# Output timeline chain as JSON
cogito log dec_20260728_x8k2p9 --json
```

### `cogito search <query>`

Fast, relevance-ranked full-text search across decision summaries, rationales, contexts, consequences, tags, and authors.

```bash
# Full-text search
cogito search "PostgreSQL persistence"

# Filter search results by status
cogito search "caching" --status active

# Output search results as JSON
cogito search "JWT" --json
```

### `cogito serve`

Start the Model Context Protocol (MCP) server over stdio for use with Claude Code or other MCP-compatible clients.

```bash
cogito serve
```

### `cogito dashboard`

Start the local React web dashboard server.

```bash
cogito dashboard [--port 3333] [--no-open]
```

---

## MCP tools reference

When running as an MCP server (`cogito serve`), `cogito` exposes four tools:

### `query_decisions`

Find decisions relevant to a file path or tag list.

**Parameters:**
- `file_path` (string, optional): File path to match against decision glob scopes.
- `tags` (string[], optional): Array of tags to filter by.

### `record_decision`

Record a new architectural decision.

**Parameters:**
- `summary` (string, required): One-line summary.
- `rationale` (string, required): Why this decision was made.
- `scope` (string[], required): Glob patterns for affected files.
- `tags` (string[], optional): Categorization tags.
- `author` (string, default: `"anonymous"`): Author name.
- `context` (string, optional): Additional background context.
- `consequences` (string, optional): Expected consequences.
- `confidence` (enum, default: `"explicit"`): `explicit`, `inferred`, or `suggested`.
- `supersedes` (string, optional): ID of superseded decision.

### `list_decisions`

List all decisions with optional status and tag filtering.

**Parameters:**
- `status` (enum, optional): `active`, `superseded`, or `archived`.
- `tags` (string[], optional): Filter by tags.

### `get_decision`

Fetch complete details of a decision by ID.

**Parameters:**
- `id` (string, required): Decision ID (e.g. `dec_20260728_x8k2p9`).

---

## Monorepo support

Decision Tracker has first-class monorepo support out of the box with zero external configuration needed.

### Automatic workspace discovery
Automatically detects workspace layouts defined in:
- `pnpm-workspace.yaml`
- `package.json` (`workspaces: [...]`)
- `lerna.json`, `turbo.json`, or `nx.json`
- Conventional `packages/*`, `apps/*`, `libs/*` structures

### Package-level precedence
In a monorepo, packages can have their own isolated `.decisions/` directories alongside the repository root's `.decisions/`:
- **Package Precedence**: When checking a file like `packages/auth/src/jwt.ts`, decisions in `packages/auth/.decisions/` take precedence over root-level decisions.
- **Inherited Context**: Root-level architectural rules (such as repository-wide linting, logging, or licensing constraints) still apply as complementary rules.
- **Cross-Package Overview**: Listing commands and API queries aggregate across both root and package scopes.

---

## Programmatic API

Decision Tracker exports a complete, fully-typed TypeScript API for embedding architectural memory into scripts, build steps, custom bots, or custom dev tools:

```typescript
import {
  check,
  record,
  list,
  get,
  doctor,
  lint,
  getTimeline,
  DecisionStore,
  matchFileSemantically
} from 'decision-tracker';

// 1. Check applicable decisions for a file path
const applicable = check('.', 'src/api/auth.ts');
console.log(`Found ${applicable.length} decisions governing this file.`);

// 2. Record a decision programmatically
const decision = record('.', {
  summary: 'Standardize on Fastify for microservices',
  rationale: 'High throughput, low overhead, and native schema validation',
  scope: ['src/services/**'],
  tags: ['fastify', 'api', 'backend'],
  author: 'platform-team',
  reviewBy: '2026-12-31'
});

// 3. Run Staleness Doctor diagnostics
const report = doctor({ baseDir: '.' });
console.log(`Health: ${report.healthy ? 'Healthy' : 'Issues found'}`);

// 4. Object-Oriented DecisionStore
const store = new DecisionStore('./my-repo');
const allDecisions = await store.list({ status: 'active' });
```

---

## Local semantic matching (opt-in)

For complex repositories, files might relate to architectural decisions even when not matching an explicit glob pattern (e.g. dynamic imports, refactored directories).

Decision Tracker includes an offline, **zero-network semantic analyzer**:
- **Import Analysis**: Scans `import` and `require()` statements in TypeScript/JavaScript to match against decision tags and technologies.
- **Architectural Keyword Extraction**: Identifies key architectural terminology in file contents matching decision summaries and rationale.
- **Zero Network / 100% Offline**: Runs locally in milliseconds with zero dependencies on external LLM APIs or network services.
- **Pluggable Architecture**: You can supply custom semantic matcher plugins via `matchFileSemantically(baseDir, filePath, { customPlugin })`.

```typescript
import { matchFileSemantically } from 'decision-tracker';

const matches = matchFileSemantically('.', 'src/handlers/payment.ts');
for (const match of matches) {
  console.log(`Decision "${match.decision.summary}" matched with score ${match.score}`);
  console.log('Reasons:', match.reasons);
}
```

---

## Philosophy

### Advisory, not blocking

`cogito` never blocks developers or prevents commits. It surfaces information — *"Here is what was decided before, and why"* — allowing humans and AI agents to make informed choices. If circumstances change, supersede or archive the decision.

### Decisions are living documents

Decisions evolve with your project over time:
- **Superseded**: A new decision replaces an outdated one (old decision moves to `.decisions/superseded/`).
- **Archived**: A decision stops being relevant (moved to `.decisions/archived/`).
- **Updated**: Rationale or scopes are refined as system understanding deepens.

### Human-readable first

Decisions are standard Markdown files stored directly in your repository. They can be read with `cat` or `vim`, reviewed in PRs, and diffed with Git. `index.json` is a derived cache — the Markdown files are always the source of truth.

### Works with your version control

Because `.decisions/` lives inside your repository, architectural context travels with your code, stays in sync across branches, and persists across forks.

---

## Examples

### The kind of decisions this is for

| Decision | Why it matters |
|----------|---------------|
| *"Don't add caching to the user profile endpoint"* | Previous team tried it, stale data caused support escalations. Without this record, future engineers will attempt caching again. |
| *"Keep notification service as a separate process"* | Embedding it caused memory exhaustion under burst traffic. Appears like unnecessary complexity without historical context. |
| *"Browser extension must not import from `src/api/payments/`"* | PCI DSS compliance boundary. An AI agent cannot infer regulatory constraints without explicit advisory context. |
| *"The `/admin` endpoints intentionally skip rate limiting"* | Internal batch operations broke under rate limits. Appears like a security flaw without recorded rationale. |
| *"Chose Postgres over DynamoDB for audit logging"* | Compliance reporting required complex relational queries. Appears like append-only key-value data at first glance. |

### Capture decisions from a coding session

During a conversation with Claude Code:

```text
You: Can we add the payment flow to the browser extension?
Claude: Exposing payment endpoints to the browser extension would bring the extension into PCI DSS compliance scope. I recommend keeping payment logic in the web application and redirecting from the extension.
You: Good call, let's do that.
Claude: [Records decision via record_decision tool or by running /decide]
```

Later, when modifying extension code:

```text
Claude: Advisory: 1 existing architectural decision applies to this file:
  - Do not expose payment endpoints to browser extension API (PCI DSS scope implications)
  This file is in the extension codebase — payment imports are intentionally excluded here.
  Would you like to proceed?
```

### Review decisions before starting work

```bash
$ cogito list --status active

📋 Found 3 Decision(s):

• [dec_20260728_x8k2p9] 🟢 active
  Summary:   Do not expose payment endpoints to browser extension API
  Scope:     src/api/payments/**/*.ts, src/extension/**/*.ts
  Tags:      security, payments, extension
  Created:   2026-07-28T15:00:00Z
```

### Check a file before modifying it

```bash
$ cogito check src/extension/api/client.ts

⚠️  1 Architectural Decision(s) match 'src/extension/api/client.ts':

--------------------------------------------------
ID:        dec_20260728_x8k2p9
Summary:   Do not expose payment endpoints to browser extension API
Rationale: Browser extension context has weaker isolation; exposing payment APIs brings extension into PCI DSS scope
Scope:     src/api/payments/**/*.ts, src/extension/**/*.ts
Tags:      security, payments, extension
Author:    tarunagnihotri
--------------------------------------------------
```

---

## How it compares

| Capability | Traditional ADRs (`docs/adr/`) | Wiki / Notion | Inline Code Comments | Static Rules (`.cursorrules`) | `cogito` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Surfaces on File Edits** | ❌ (Manual only) | ❌ (Detached) | ⚠️ (If you read surrounding code) | ⚠️ (Loaded globally on every turn) | ✅ **Automated via Hook & MCP** |
| **Context Window Impact** | 0 tokens (never loaded) | 0 tokens | Clutters source code | High token cost (global context) | **Zero bloat (scoped only to target file)** |
| **AI Agent Integration** | ❌ None | ❌ None | ⚠️ Passive only | ⚠️ Static prompts | ✅ **MCP tools + Hooks + Slash commands** |
| **PR & CI Validation** | ❌ None | ❌ None | ❌ None | ❌ None | ✅ **GitHub Action checks PR diffs** |
| **Lifecycle & Supersession** | ⚠️ Manual headers | ❌ Stales silently | ❌ Forgotten in code | ❌ Prone to bloat | ✅ **Active, Superseded, Archived tree** |
| **Visual Dashboard** | ❌ None | ⚠️ Generic pages | ❌ None | ❌ None | ✅ **Local Web UI with Graph & Doctor** |
| **Diagnostics & Linting** | ❌ None | ❌ None | ❌ None | ❌ None | ✅ **Schema validation & scope staleness doctor** |

---

## FAQ

### 🔒 Privacy: Does any code or context leave my machine?
**No. Nothing leaves your machine.**
- `cogito` runs 100% locally.
- All decisions are saved in `.decisions/` within your git repository.
- There are no telemetry pings, external analytics, or remote API calls.
- Decision matching is performed using fast, local glob and AST inspection (<5ms).

### 🚦 Is this advisory or blocking?
**Advisory by default.**
`cogito` acts as an institutional guide, not an impediment. When you or an AI agent edit a file that matches an active architectural decision, it surfaces a non-blocking advisory notification containing the ID, rationale, and scope. You can proceed with modifications, update the decision, or supersede it at any time.

### 🤖 Which AI agents and editors are supported?
`cogito` is tool-agnostic:
- **Claude Code**: Native MCP server + `PostToolUse` hook + `/decide` slash command.
- **Cursor**: Export directly to `.cursorrules` or `.cursor/rules/*.mdc`.
- **GitHub Copilot**: Export managed architectural sections to `.github/copilot-instructions.md`.
- **Windsurf**: Export to `.windsurfrules`.
- **Roo Code / Cline / Any MCP Client**: Connects directly via standard stdio MCP protocol (`cogito server`).

### 📦 How does it work with monorepos?
`cogito` natively detects monorepos (npm/pnpm/yarn workspaces, Lerna, Turborepo). Package-level decisions in subpackages automatically take precedence over root-level decisions when files within that subpackage are edited.

---

## Tech stack

- **[TypeScript](https://www.typescriptlang.org/)** — Node.js 20+, ES2022 modules
- **[@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** — MCP server implementation
- **[commander](https://www.npmjs.com/package/commander)** — CLI framework
- **[gray-matter](https://www.npmjs.com/package/gray-matter)** — YAML frontmatter parser
- **[minimatch](https://www.npmjs.com/package/minimatch)** — Glob pattern matching engine
- **[zod](https://www.npmjs.com/package/zod)** — Input schema validation
- **[nanoid](https://www.npmjs.com/package/nanoid)** — Collision-resistant ID generation
- **[React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) + [Vite](https://vitejs.dev/)** — Web dashboard UI
- **[Express](https://expressjs.com/)** — Local dashboard server
- **[vitest](https://vitest.dev/)** — Test runner

---

## 👤 Author

**Tarun Agnihotri**
- GitHub: [@tarunagnihotri534](https://github.com/tarunagnihotri534)
- Repository: [decision-tracker](https://github.com/tarunagnihotri534/decision-memory)

---

## 📄 License

MIT
