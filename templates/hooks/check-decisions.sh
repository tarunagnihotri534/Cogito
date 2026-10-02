#!/usr/bin/env bash
# PostToolUse hook for Claude Code
# Checks if any architectural decisions apply to the file being edited.
# Reads hook JSON from stdin, outputs advisory system message if decisions found.

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract the file path from tool_input (handles both Write/Edit tools)
FILE_PATH=""
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | node -e '
    try {
      const data = JSON.parse(fs.readFileSync(0, "utf-8"));
      const p = data?.tool_input?.file_path || data?.tool_input?.path || "";
      console.log(p);
    } catch (e) {
      console.log("");
    }
  ' 2>/dev/null)
fi

if [ -z "$FILE_PATH" ]; then
  # No file path in tool input, nothing to check
  exit 0
fi

# Make path relative to project root if absolute
if [[ "$FILE_PATH" = /* ]]; then
  FILE_PATH=$(realpath --relative-to="$(pwd)" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
fi

# Query decisions for this file path (try local node dist/cli execution first for speed, fallback to npx)
DECISIONS=""
if [ -f "dist/cli/index.js" ]; then
  DECISIONS=$(node dist/cli/index.js check "$FILE_PATH" --json 2>/dev/null || echo "[]")
elif command -v cogito >/dev/null 2>&1; then
  DECISIONS=$(cogito check "$FILE_PATH" --json 2>/dev/null || echo "[]")
elif command -v decision-tracker >/dev/null 2>&1; then
  DECISIONS=$(decision-tracker check "$FILE_PATH" --json 2>/dev/null || echo "[]")
else
  DECISIONS=$(npx --yes cogito-cli check "$FILE_PATH" --json 2>/dev/null || echo "[]")
fi

# Check if any decisions were found
COUNT=0
if command -v jq >/dev/null 2>&1; then
  COUNT=$(echo "$DECISIONS" | jq 'length' 2>/dev/null || echo "0")
else
  COUNT=$(echo "$DECISIONS" | node -e '
    try {
      const arr = JSON.parse(fs.readFileSync(0, "utf-8"));
      console.log(Array.isArray(arr) ? arr.length : 0);
    } catch (e) {
      console.log(0);
    }
  ' 2>/dev/null || echo "0")
fi

if [ "$COUNT" -gt 0 ]; then
  if command -v jq >/dev/null 2>&1; then
    SUMMARIES=$(echo "$DECISIONS" | jq -r '.[] | "- \(.summary) (scope: \(.scope | join(", "))) [ID: \(.id)]"' 2>/dev/null)
    MESSAGE="Advisory: $COUNT existing architectural decision(s) may apply to this file:
$SUMMARIES
Review with: decision-tracker check $FILE_PATH
These are advisory — you may proceed, but consider whether your changes align with these decisions."

    jq -n --arg msg "$MESSAGE" '{systemMessage: $msg}'
  else
    echo "$DECISIONS" | node -e '
      try {
        const fs = require("fs");
        const list = JSON.parse(fs.readFileSync(0, "utf-8"));
        const filePath = process.argv[1];
        const summaries = list.map(d => `- ${d.summary} (scope: ${d.scope.join(", ")}) [ID: ${d.id}]`).join("\n");
        const msg = `Advisory: ${list.length} existing architectural decision(s) may apply to this file:\n${summaries}\nReview with: decision-tracker check ${filePath}\nThese are advisory — you may proceed, but consider whether your changes align with these decisions.`;
        console.log(JSON.stringify({ systemMessage: msg }));
      } catch (e) {}
    ' "$FILE_PATH"
  fi
fi
