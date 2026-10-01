# VHS tape script for recording terminal demo GIF
# Prerequisites: https://github.com/charmbracelet/vhs (`brew install vhs` or `go install github.com/charmbracelet/vhs@latest`)
# Run: vhs scripts/demo.tape

Output docs/images/demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 920
Set Height 520
Set Theme "TokyoNight"
Set Padding 20
Set TypingSpeed 45ms

# Start clean
Type "clear"
Enter
Sleep 1s

# 1. Initialize Decision Tracker
Type "# Initialize institutional memory in your project"
Enter
Sleep 600ms
Type "npx decision-tracker init"
Enter
Sleep 2.5s

# 2. Record an architectural decision
Type "# Capture why an architectural constraint was chosen"
Enter
Sleep 600ms
Type "npx decision-tracker record \"
Enter
Type "  --summary 'Do not expose payment APIs to browser extension' \"
Enter
Type "  --rationale 'Extension context has weaker isolation; brings extension into PCI scope' \"
Enter
Type "  --scope 'src/api/payments/**/*.ts,src/extension/**/*.ts' \"
Enter
Type "  --tags 'security,payments,extension'"
Enter
Sleep 3s

# 3. Check a file before making changes
Type "# Instant zero-latency advisory check on file modification"
Enter
Sleep 600ms
Type "npx decision-tracker check src/extension/api/client.ts"
Enter
Sleep 3.5s

# 4. List active decisions
Type "# View all active architectural constraints"
Enter
Sleep 600ms
Type "npx decision-tracker list"
Enter
Sleep 4s
