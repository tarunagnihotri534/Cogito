# Release Guide for decision-tracker

This document details the exact, step-by-step process for publishing and maintaining releases of `cogito`.

---

## 1. Prerequisites & Account Setup

1. **npm Account & 2FA**:
   - Ensure you are logged in to [npmjs.com](https://www.npmjs.com/).
   - Two-Factor Authentication (2FA) is mandatory on npm for package authors.
   - Run locally:
     ```bash
     npm whoami
     ```

2. **Repository Consistency**:
   - Confirm your GitHub repository URL matches `package.json`:
     `https://github.com/tarunagnihotri534/decision-memory`
   - If your GitHub repository is currently named `decision-memory`, rename it in **GitHub Settings -> General -> Repository name** to `cogito`. (GitHub automatically redirects git and web traffic, but keeping names uniform ensures provenance attestations align).

3. **npm Authentication in GitHub Actions**:
   - **For First Release (v0.1.0)**:
     - Generate an **Automation Token** on npmjs.com (**Account -> Access Tokens -> Generate New Token -> Type: Automation**).
     - In GitHub repository settings: **Settings -> Secrets and variables -> Actions -> New repository secret**.
     - Name: `NPM_TOKEN`
     - Value: `<your-npm-token>`
   - **Configuring Trusted Publishing (OIDC) for Future Releases**:
     - Once `cogito` has been published to npm at least once, navigate to:
       `https://www.npmjs.com/package/cogito-cli/access`
     - Under **Trusted Publishing**, click **Add new publisher -> GitHub Actions**.
     - Set Owner: `tarunagnihotri534`
     - Set Repository: `cogito`
     - Set Workflow filename: `release.yml`
     - Once configured, you can remove the `NPM_TOKEN` secret if desired.

---

## 2. Pre-Release Local Verification

Before tagging the release, run the automated verification locally:

```bash
# 1. Type check
npm run lint

# 2. Run test suites
npm test

# 3. Clean build (CLI and dashboard)
npm run build

# 4. Dry-run package inspection
npm pack --dry-run
```

Confirm that:
- Total files: ~83 files
- Package size: ~210 kB
- No test files, `.env`, or `.map` files are included.
- Version is `0.1.0`.

---

## 3. Creating & Pushing the Release Tag

When ready to trigger the release pipeline:

```bash
# 1. Ensure you are on the main branch with a clean working tree
git checkout main
git pull origin main

# 2. Create an annotated git tag
git tag -a v0.1.0 -m "Release v0.1.0: Initial public release"

# 3. Push the tag to GitHub
git push origin v0.1.0
```

---

## 4. Pipeline Execution & Verification

Pushing tag `v0.1.0` triggers the `.github/workflows/release.yml` workflow.

### Automated Workflow Jobs

1. **`test-and-smoke`**:
   - Runs `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
   - Executes `bash scripts/smoke-test.sh` in a clean environment, testing `npx` against the packed tarball, `init`, `record`, `check`, `list`, `export`, `lint`, and `doctor`.

2. **`publish-npm`**:
   - Publishes to the public npm registry with `--provenance --access public`.
   - Uses GitHub OIDC (`id-token: write`) to cryptographically sign the build provenance.

3. **`docker-and-release`**:
   - Builds the production multi-stage, non-root container image.
   - Pushes images to GitHub Container Registry:
     - `ghcr.io/tarunagnihotri534/decision-memory:0.1.0`
     - `ghcr.io/tarunagnihotri534/decision-memory:latest`
   - Parses the `0.1.0` release notes from `CHANGELOG.md` and creates a GitHub Release.

4. **`post-publish-verify`**:
   - Spawns a clean `node:20-bookworm-slim` container.
   - Waits for npm registry replication.
   - Executes `npx --yes decision-tracker@0.1.0 --version` to verify end-to-end user experience.

---

## 5. Post-Release Verification Steps

After CI completes:

1. **Verify npm Package & Provenance**:
   - Visit: `https://www.npmjs.com/package/cogito-cli`
   - Verify the version reads `0.1.0`.
   - Verify the **Provenance** checkmark badge appears on the right sidebar.

2. **Verify CLI via npx**:
   ```bash
   npx --yes decision-tracker@latest --version
   ```
   Should print: `0.1.0`.

3. **Verify GitHub Release**:
   - Visit: `https://github.com/tarunagnihotri534/decision-memory/releases/tag/v0.1.0`
   - Confirm release notes and assets match.

4. **Verify Docker Image**:
   ```bash
   docker run --rm ghcr.io/tarunagnihotri534/decision-memory:0.1.0 --version
   ```

5. **Submit Listings**:
   - Follow instructions in `launch/mcp-registry.md` to submit to the official MCP registry, Smithery, mcp.so, and PulseMCP.
