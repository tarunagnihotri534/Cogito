# 60-Second Terminal Demo Storyboard

This script outlines the exact visual progression for recording the terminal GIF / video demo using VHS (`scripts/demo.tape`) or manual recording with asciinema.

---

## Target Audience & Goal
- **Audience**: AI engineers, tech leads, developers using Claude Code / Cursor.
- **Key Takeaway**: In under 60 seconds, demonstrate how `cogito` captures architectural rationale and injects zero-latency context the moment governed code is touched.

---

## Scene-by-Scene Breakdown

| Timestamp | Visual Action | Command Run | On-Screen Output / Voiceover Note |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:08** | Clean terminal. Quick header display. | `npx cogito init` | Displays clean green checkmarks: scaffolds `.decisions/`, installs Claude Code `PostToolUse` hook, and `/decide` slash command. |
| **00:08 - 00:25** | Authoring a new architectural constraint with target scope. | `npx cogito record \<br>&nbsp;&nbsp;--summary "Do not expose payment APIs to browser extension" \<br>&nbsp;&nbsp;--rationale "Extension context has weaker isolation; PCI DSS scope" \<br>&nbsp;&nbsp;--scope "src/api/payments/**/*.ts,src/extension/**/*.ts" \<br>&nbsp;&nbsp;--tags "security,payments"` | Confirms recorded decision `dec_20261001_x8k2p9` in `.decisions/active/`. Highlights that the decision is now actively tracked in git. |
| **00:25 - 00:40** | Developer or AI agent attempts to edit a governed file. | `npx cogito check src/extension/api/client.ts` | **The "Aha!" Moment**: Instant (<5ms) advisory banner surfaces: `⚠️ 1 Architectural Decision(s) match 'src/extension/api/client.ts'`, showing ID, rationale, and scope. |
| **00:40 - 00:50** | Listing all active project decisions. | `npx cogito list` | Displays active decisions formatted cleanly with IDs, scopes, tags, and status dots (🟢 active). |
| **00:50 - 00:60** | Multi-agent sync to Cursor rules. | `npx cogito export --target cursor` | Exports `.cursor/rules/*.mdc`. Closes on repository link: `github.com/tarunagnihotri534/decision-memory`. |

---

## Recording Tips for VHS / Asciinema
- Ensure 920x520 terminal size for optimal embedding in GitHub README and social previews.
- Use a high-contrast dark theme (TokyoNight or Catppuccin Mocha).
- Keep typing cadence steady (45-50ms per character).
- Use `scripts/demo.tape` to reproduce the demo automatically anytime CLI features change.
