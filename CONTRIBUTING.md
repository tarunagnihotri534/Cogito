# Contributing to decision-tracker

Thank you for your interest in contributing to `cogito`! This project provides institutional memory for codebases, bridging human architectural decisions and AI coding agents.

## Development Setup

### Prerequisites
- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **Git**

### Clone and Install

```bash
git clone https://github.com/tarunagnihotri534/decision-memory.git
cd decision-tracker
npm install
```

### Build & Run Tests

```bash
# Type check and build both CLI and web dashboard
npm run build

# Run unit and integration tests
npm test

# Type check
npm run lint

# Run CLI during development
npm run dev -- --help
```

## Project Structure

```
├── bin/                 # Executable entrypoint (decision-tracker)
├── schema/              # JSON Schema for architectural decision markdown files
├── src/
│   ├── cli/             # Commander-based CLI interface
│   ├── core/            # Decision storage, search, lint, doctor, exporters, conflict detection
│   ├── dashboard/       # Express API server + React/Tailwind visual dashboard
│   ├── mcp/             # Model Context Protocol (MCP) server implementation
│   └── types/           # TypeScript interfaces and Zod schemas
├── templates/           # Default hooks (check-decisions.sh) and slash commands
├── tests/               # Vitest test suites
└── action.yml           # GitHub Action definition for CI PR checks
```

## Pull Request Guidelines

1. **Keep it focused**: Each pull request should address a single feature, bug fix, or documentation enhancement.
2. **Add tests**: Any change to decision storage, matching, linting, CLI, or MCP tools should be backed by tests in `tests/`.
3. **Verify tests and builds**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. **Follow conventions**:
   - TypeScript strict mode enabled.
   - ES modules (`import`/`export`).
   - Use Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).

## Code of Conduct

Please maintain a welcoming, respectful, and constructive environment for all contributors and maintainers.
