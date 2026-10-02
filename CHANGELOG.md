# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-01

### Added
- **Core Decision Storage**: Local-first scoped architectural decision capture in `.decisions/{active,superseded,archived}/` with YAML frontmatter and Markdown body.
- **Fast Matching Engine**: Glob-based matching (`minimatch`) surfacing relevant decisions instantly when affected files are modified.
- **Model Context Protocol (MCP) Server**:
  - `record_decision`: Capture architectural choices directly inside AI coding conversations.
  - `check_file_decisions`: Query active decisions governing target files.
  - `list_decisions`: Filter by status and tags.
  - `get_decision`: Retrieve full decision context and rationale.
  - `search_decisions`: Full-text search with relevance ranking.
  - `get_decision_timeline`: Trace supersession history.
  - `run_doctor`: Identify stale decisions, orphaned scopes, and missing files.
- **CLI Commands**:
  - `cogito init`: Scaffolds `.decisions/`, installs Claude Code hooks, and configures `.claude/` commands.
  - `cogito record`: Interactive or flag-driven decision authoring.
  - `cogito check`: Query matching decisions for specific file paths (supports `--json`).
  - `cogito list`: Display formatted decision summaries.
  - `cogito show`: Display complete decision details.
  - `cogito supersede`: Deprecate older decisions with full rationale linkage.
  - `cogito export`: Multi-agent export to `.cursorrules`, `CLAUDE.md`, `.windsurfrules`, `.github/copilot-instructions.md`, or custom targets with managed section markers.
  - `cogito import --format adr`: Bi-directional import from existing ADR directories with supersession resolution.
  - `cogito propose`: Extract candidate decisions from agent session transcripts.
  - `cogito review`: Review proposed candidate decisions before activating.
  - `cogito lint`: Validate decision markdown schemas and directory structure.
  - `cogito doctor`: Diagnostic health check for scope staleness.
  - `cogito search`: Full-text search across summaries, rationale, and notes.
  - `cogito timeline`: Visual tree representation of decision supersessions.
  - `cogito dashboard`: Local visual web interface for exploring and managing decisions.
- **Visual Web Dashboard**:
  - Express API server + React frontend with dark-mode slate theme.
  - Interactive decision browsing, filtering, search, and recording.
  - Live doctor diagnostics and supersession timeline visualization.
- **Integrations**:
  - Claude Code hook (`PostToolUse` trigger).
  - Pre-commit git hook sync (`export --install-pre-commit`).
  - GitHub Action (`action.yml`) for automatic PR review comments with relevant architectural decisions.
  - Monorepo support with package-level precedence over root decisions.
  - Local semantic import matcher for identifying related architectural boundaries.
