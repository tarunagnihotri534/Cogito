# Architectural Decision Record Assistant

Review the recent conversation transcript and identify any architectural or key technical decisions that were made or agreed upon during this coding session.

For each distinct decision identified:
1. Extract a clear one-line **summary**.
2. State the **rationale** (why this approach was chosen over alternatives).
3. Determine the glob pattern **scope** (e.g. `src/api/**/*.ts`, `src/components/auth/*`).
4. Assign relevant **tags** (e.g., `architecture`, `security`, `performance`, `database`).
5. Specify the **author** (or user/team).
6. State optional **context** or **consequences** if discussed.

Then invoke the MCP tool `record_decision` or run the CLI command:
`cogito record --summary "..." --rationale "..." --scope "..." --tags "..."`

Confirm to the user once all architectural decisions have been recorded.
