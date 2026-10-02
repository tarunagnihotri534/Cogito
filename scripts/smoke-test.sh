#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🧪 Running Cogito Smoke Test"
echo "=========================================="

# 1. Build and pack
echo "📦 Packaging cogito-cli..."
npm run build
TGZ_NAME=$(npm pack --quiet | tail -n 1)
TGZ_PATH="$(pwd)/$TGZ_NAME"

if [ ! -f "$TGZ_PATH" ]; then
  echo "❌ Error: Tarball $TGZ_PATH not found!"
  exit 1
fi
echo "✅ Packed tarball: $TGZ_PATH"

# 2. Test npx directly against the tarball
echo "🚀 Testing npx directly against tarball..."
NPX_VERSION=$(npx --yes --package "$TGZ_PATH" cogito --version)
echo "   Reported version via npx: $NPX_VERSION"
if [ "$NPX_VERSION" != "0.1.0" ]; then
  echo "❌ Error: Expected version 0.1.0, got $NPX_VERSION"
  exit 1
fi
echo "✅ npx execution passed!"

# 3. Create clean-room temporary directory
TEST_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'dt-test')
echo "📁 Created temporary clean-room directory: $TEST_DIR"

cleanup() {
  echo "🧹 Cleaning up temporary directory..."
  rm -rf "$TEST_DIR"
  rm -f "$TGZ_PATH"
}
trap cleanup EXIT

# 4. Install global CLI from tarball
echo "📥 Installing tarball globally..."
npm install -g "$TGZ_PATH"

# 5. Initialize git repo and test CLI commands
cd "$TEST_DIR"
git init
git config user.name "Smoke Test Runner"
git config user.email "test@example.com"

echo "⚙️ Testing 'cogito init'..."
cogito init

if [ ! -d ".decisions" ]; then
  echo "❌ Error: .decisions directory was not created!"
  exit 1
fi
echo "✅ Init successful!"

echo "📝 Testing 'cogito record'..."
cogito record \
  --summary "Isolate authentication tokens in HTTP-only cookies" \
  --rationale "Prevent XSS exfiltration of session credentials" \
  --scope "src/auth/**/*.ts" \
  --tags "security,auth" \
  --author "Release Automation"

CREATED_DECISION=$(ls -1 .decisions/active/*.md 2>/dev/null | head -n 1)
if [ -z "$CREATED_DECISION" ]; then
  echo "❌ Error: Decision file was not created in .decisions/active!"
  exit 1
fi
echo "✅ Record successful: $CREATED_DECISION"

echo "🔍 Testing 'cogito check'..."
CHECK_OUTPUT=$(cogito check "src/auth/session.ts" --json)
if echo "$CHECK_OUTPUT" | grep -q "Isolate authentication tokens"; then
  echo "✅ Check successfully matched active decision!"
else
  echo "❌ Error: Check did not match expected decision: $CHECK_OUTPUT"
  exit 1
fi

echo "📋 Testing 'cogito list'..."
cogito list

echo "📤 Testing 'cogito export --target all'..."
cogito export --target all

echo "🔬 Testing 'cogito lint'..."
cogito lint

echo "🩺 Testing 'cogito doctor'..."
cogito doctor

echo "=========================================="
echo "🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY!"
echo "=========================================="
