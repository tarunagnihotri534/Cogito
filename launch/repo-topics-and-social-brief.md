# GitHub Repository Topics & Social Preview Image Brief

---

## 1. Suggested GitHub Repository Topics (Tags)

Paste these topics directly into the **About -> Topics** section of the GitHub repository (`https://github.com/tarunagnihotri534/decision-memory`):

```
mcp
mcp-server
model-context-protocol
architecture-decision-records
adr
claude-code
cursor
copilot
windsurf
developer-tools
institutional-memory
codebase-context
ai-agents
context-engineering
typescript
```

### Rationale
- `mcp` / `mcp-server` / `model-context-protocol`: Essential for discovery within the booming Model Context Protocol ecosystem.
- `adr` / `architecture-decision-records`: Catches engineers actively searching for solutions to stale or unmanaged ADRs.
- `claude-code` / `cursor` / `copilot` / `windsurf`: Directly targets users of top AI coding tools looking for context preservation.
- `institutional-memory` / `codebase-context`: Defines the core product category.

---

## 2. Social Preview Image (OpenGraph / Twitter Card) Design Brief

### Dimensions & Specifications
- **Dimensions**: 1280 × 640 px (standard 2:1 aspect ratio for GitHub social preview, Twitter card, and LinkedIn link preview).
- **Format**: PNG or WebP (<1MB).
- **Color Palette**:
  - Background: Deep slate radial gradient (`#0f172a` to `#1e293b`).
  - Primary Accent: Indigo glow (`#6366f1` / `#818cf8`).
  - Secondary Accent: Emerald green (`#10b981` / `#34d399`) for active status and Cyan (`#38bdf8`) for AI tools.
  - Text: Bright white (`#f8fafc`) for headers, Slate (`#94a3b8`) for subtext.

### Layout Hierarchy

1. **Top Left**:
   - Icon / Logo: 🧠 Glowing neon brain / node graph icon.
   - Project Name: `cogito` (Bold, 44px, Inter/Outfit).
   - Version Tag: `v0.1.0` in a sleek badge (indigo border with subtle fill).

2. **Main Headline (Center Left)**:
   - Font: Inter or Outfit, 52px, Bold.
   - Text: **Institutional Memory for Your Codebase**
   - Subtitle (32px, Slate): *Captures the why behind architectural decisions. Surfaces them automatically when matching files are edited.*

3. **Graphic / Mockup (Center Right)**:
   - A floating glassmorphic terminal window with subtle drop shadow:
     ```bash
     $ cogito check src/extension/client.ts
     ⚠️ 1 Architectural Decision matches:
     • [PCI Scope] Exclude payment APIs from extension
     ```
   - Sleek badges below the terminal showing compatibility:
     `[ Claude Code ]` `[ Cursor ]` `[ MCP ]` `[ Copilot ]`

4. **Bottom Bar**:
   - Left: `100% Local · Zero Token Bloat · MIT Open Source`
   - Right: `github.com/tarunagnihotri534/decision-memory`

---

## 3. GitHub Repository Description & Website

- **Description**: Institutional memory for your codebase. Captures architectural decisions and surfaces them automatically when relevant files are edited.
- **Website URL**: `https://github.com/tarunagnihotri534/decision-memory#readme` (or npm package URL: `https://www.npmjs.com/package/cogito-cli`).
