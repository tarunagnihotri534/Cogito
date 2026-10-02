# MCP Registry & Marketplace Submission Details

This guide provides the exact submission metadata, manifests, and instructions for listing `cogito` across all major Model Context Protocol registries and directories.

---

## 1. Official MCP Registry (Model Context Protocol)

The official registry catalogs MCP servers using reverse-DNS identifiers and the official schema.

### Registry Identity
- **Server Identifier**: `io.github.tarunagnihotri534/decision-memory`
- **Schema**: `https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json`
- **Manifest File**: Located in repository root at [`server.json`](file:///d:/decision-memory/decision-memory/server.json).

### `server.json` Manifest
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json",
  "name": "io.github.tarunagnihotri534/decision-memory",
  "title": "decision-tracker",
  "description": "Institutional memory for your codebase. Captures architectural decisions and surfaces them automatically when relevant files are edited.",
  "version": "0.1.0",
  "websiteUrl": "https://github.com/tarunagnihotri534/decision-memory",
  "repository": {
    "type": "git",
    "url": "https://github.com/tarunagnihotri534/decision-memory.git"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "decision-tracker",
      "version": "0.1.0",
      "transport": {
        "type": "stdio"
      },
      "command": "decision-tracker",
      "args": ["server"]
    }
  ]
}
```

### Submission Steps
1. Ensure the package is published on npm (`decision-tracker@0.1.0`).
2. Run the official publisher CLI:
   ```bash
   npx @modelcontextprotocol/registry-publisher publish
   ```
3. Authenticate with your GitHub account when prompted to verify ownership of `tarunagnihotri534/decision-memory`.
4. Alternatively, submit a PR to the official registry repository:
   - Target Repo: `https://github.com/modelcontextprotocol/registry`
   - File Path: `servers/io/github/tarunagnihotri534/decision-memory/server.json`

---

## 2. Smithery.ai

Smithery is a leading MCP registry with 1-click install for Claude Desktop, Cursor, and CLI.

### Manifest File
Located in repository root at [`smithery.yaml`](file:///d:/decision-memory/decision-memory/smithery.yaml):
```yaml
# Smithery.ai configuration for decision-tracker
# https://smithery.ai/docs/config
startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      workspace:
        type: string
        description: Path to target repository workspace (defaults to current working directory)
  commandFunction: |-
    (config) => ({
      command: 'npx',
      args: ['-y', 'decision-tracker@0.1.0', 'server', ...(config?.workspace ? [config.workspace] : [])]
    })
  exampleConfig:
    workspace: "."
```

### Submission Steps
1. Navigate to: [https://smithery.ai/publish](https://smithery.ai/publish)
2. Log in with your GitHub account.
3. Select or enter the repository: `tarunagnihotri534/decision-memory`.
4. Smithery will automatically detect `smithery.yaml` and validate the `startCommand`.
5. Click **Publish Server**.
6. Verify install command on your Smithery page:
   ```bash
   npx -y @smithery/cli install decision-tracker --client claude
   ```

---

## 3. mcp.so

mcp.so is a curated directory of MCP servers and agent extensions.

### Submission Steps
1. Visit: [https://mcp.so/submit](https://mcp.so/submit)
2. Provide server metadata:
   - **Name**: `cogito`
   - **Category**: `Developer Tools` / `Memory & Context`
   - **Repository**: `https://github.com/tarunagnihotri534/decision-memory`
   - **Package URL**: `https://www.npmjs.com/package/cogito-cli`
   - **Short Description**: Institutional memory for codebases. Captures architectural decisions and surfaces them automatically when matching files are edited.
   - **Command**:
     ```json
     {
       "command": "npx",
       "args": ["-y", "decision-tracker@latest", "server"]
     }
     ```
   - **Supported Clients**: Claude Desktop, Claude Code, Cursor, Windsurf, Roo Code.

---

## 4. PulseMCP

PulseMCP indexes active MCP servers, tools, and developer utilities.

### Submission Steps
1. Visit: [https://pulsemcp.com/submit](https://pulsemcp.com/submit)
2. Fill out submission form:
   - **Server Name**: `cogito`
   - **Source Code**: `https://github.com/tarunagnihotri534/decision-memory`
   - **Documentation**: `https://github.com/tarunagnihotri534/decision-memory#readme`
   - **License**: `MIT`
   - **Transport**: `stdio`
   - **Tags**: `memory`, `architecture`, `codebase-context`, `claude-code`, `cursor`
   - **Author Contact**: GitHub `@tarunagnihotri534`
