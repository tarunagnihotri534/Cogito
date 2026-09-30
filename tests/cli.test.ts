import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Decision Tracker CLI Integration Tests', () => {
  let tmpDir: string;
  const tsxCliPath = path.resolve(__dirname, '../src/cli/index.ts');
  const localTsxBin = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-cli-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function runCli(args: string): string {
    return execSync(`node "${localTsxBin}" "${tsxCliPath}" ${args}`, {
      cwd: tmpDir,
      encoding: 'utf-8'
    });
  }

  it('should initialize repository via CLI init', { timeout: 30000 }, () => {
    const out = runCli('init');
    expect(out).toContain('Initialized decision storage');

    expect(fs.existsSync(path.join(tmpDir, '.decisions/active'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude/hooks/check-decisions.sh'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude/commands/decide.md'))).toBe(true);
  });

  it('should record decision via CLI record and match via check --json', { timeout: 30000 }, () => {
    runCli('init');

    const recordOut = runCli(
      'record --summary "Enforce HTTPS redirect" --rationale "Security requirement" --scope "src/server/**/*.ts" --tags "security,network" --author "charlie"'
    );
    expect(recordOut).toContain('Recorded decision');

    const checkOut = runCli('check "src/server/index.ts" --json');
    const matches = JSON.parse(checkOut);

    expect(matches.length).toBe(1);
    expect(matches[0].summary).toBe('Enforce HTTPS redirect');
    expect(matches[0].author).toBe('charlie');
  });

  it('should list and get decisions via CLI', { timeout: 30000 }, () => {
    runCli('init');
    runCli(
      'record --summary "GraphQL API Gateway" --rationale "Consolidate endpoints" --scope "src/graphql/**/*.ts" --tags "api"'
    );

    const listJson = runCli('list --json');
    const items = JSON.parse(listJson);
    expect(items.length).toBe(1);

    const id = items[0].id;
    const getOut = runCli(`get "${id}"`);
    expect(getOut).toContain('GraphQL API Gateway');
    expect(getOut).toContain('Consolidate endpoints');
  });
  it('should export decisions to all targets via CLI export --json', { timeout: 30000 }, () => {
    runCli('init');
    runCli(
      'record --summary "Use ESLint flat config" --rationale "Standardized linting" --scope "eslint.config.js" --tags "linting"'
    );

    const exportOut = runCli('export --json');
    const result = JSON.parse(exportOut);
    expect(result.success).toBe(true);
    expect(result.targets.length).toBe(4);

    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.github/copilot-instructions.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.windsurfrules'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.cursor/rules/use-eslint-flat-config.mdc'))).toBe(true);

    const checkOut = runCli('export --check --json');
    const checkResult = JSON.parse(checkOut);
    expect(checkResult.inSync).toBe(true);
  });

  it('should install pre-commit hook via CLI export --install-pre-commit', { timeout: 30000 }, () => {
    runCli('init');
    const out = runCli('export --install-pre-commit --json');
    const res = JSON.parse(out);
    expect(res.success).toBe(true);
    expect(res.path).toContain('pre-commit');
  });
  it('should propose candidates from transcript via CLI propose and review with --yes', { timeout: 30000 }, () => {
    runCli('init');

    // Create a mock transcript
    const transcriptFile = path.join(tmpDir, 'test-transcript.jsonl');
    const lines = [
      JSON.stringify({
        type: 'tool_use',
        name: 'Edit',
        input: { file_path: 'src/api/auth.ts' }
      }),
      JSON.stringify({
        role: 'assistant',
        content:
          'We decided to enforce JWT Bearer tokens for all API routes because stateless authentication enables horizontal container scaling.'
      })
    ];
    fs.writeFileSync(transcriptFile, lines.join('\n'), 'utf8');

    // 1. Run propose via CLI
    const proposeOut = runCli(`propose --transcript "${transcriptFile}" --json`);
    const proposeRes = JSON.parse(proposeOut);
    expect(proposeRes.savedCount).toBe(1);
    expect(proposeRes.proposed[0].summary).toContain('Enforce JWT Bearer tokens');

    // 2. Run review --list --json
    const listOut = runCli('review --json');
    const listRes = JSON.parse(listOut);
    expect(listRes.length).toBe(1);

    // 3. Run review --yes --min-score 0.7
    const reviewOut = runCli('review --yes --min-score 0.7');
    expect(reviewOut).toContain('Approved');

    // Verify it is now in active decisions
    const checkOut = runCli('check "src/api/auth.ts" --json');
    const matches = JSON.parse(checkOut);
    expect(matches.length).toBe(1);
    expect(matches[0].summary).toContain('Enforce JWT Bearer tokens');
  });

  it('should process hook post-tool-use via CLI hook', { timeout: 30000 }, () => {
    runCli('init');
    runCli(
      'record --summary "Single DB Connection Pool" --rationale "Prevent socket exhaustion" --scope "src/db/**/*.ts"'
    );

    const hookPayload = JSON.stringify({
      tool_name: 'Edit',
      tool_input: {
        file_path: 'src/db/client.ts'
      }
    });

    const hookFile = path.join(tmpDir, 'hook-payload.json');
    fs.writeFileSync(hookFile, hookPayload, 'utf8');

    // Pass payload via stdin using node input option
    const out = execSync(
      `node "${localTsxBin}" "${tsxCliPath}" hook post-tool-use`,
      { cwd: tmpDir, encoding: 'utf-8', input: hookPayload }
    );

    const parsed = JSON.parse(out);
    expect(parsed.systemMessage).toContain('Single DB Connection Pool');
  });
  it('should run doctor, lint, and reindex via CLI', { timeout: 30000 }, () => {
    runCli('init');
    runCli('record --summary "Architecture Rule" --rationale "Rule rationale" --scope "src/**/*.ts"');

    // 1. Doctor
    const doctorOut = runCli('doctor --json');
    const doctorRes = JSON.parse(doctorOut);
    expect(doctorRes).toHaveProperty('healthy');
    expect(doctorRes.totalActiveDecisions).toBe(1);

    // 2. Lint
    const lintOut = runCli('lint --json');
    const lintRes = JSON.parse(lintOut);
    expect(lintRes.valid).toBe(true);
    expect(lintRes.totalFiles).toBe(1);

    // 3. Reindex
    const reindexOut = runCli('reindex --json');
    const reindexRes = JSON.parse(reindexOut);
    expect(reindexRes.length).toBe(1);
    expect(reindexRes[0].summary).toBe('Architecture Rule');
  });

  it('should run why, log, and search via CLI', { timeout: 30000 }, () => {
    runCli('init');
    const r1 = runCli('record --summary "Use PostgreSQL DB" --rationale "ACID persistence" --scope "src/db/**/*.ts" --tags "database"');

    // 1. Search
    const searchOut = runCli('search "PostgreSQL" --json');
    const searchRes = JSON.parse(searchOut);
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].item.summary).toContain('PostgreSQL');

    // Extract ID
    const decId = searchRes[0].item.id;

    // 2. Why
    const whyOut = runCli('why "src/db/client.ts"');
    expect(whyOut).toContain('Use PostgreSQL DB');
    expect(whyOut).toContain('ACID persistence');

    // 3. Log (timeline)
    const logOut = runCli(`log "${decId}" --json`);
    const timeline = JSON.parse(logOut);
    expect(timeline.length).toBe(1);
    expect(timeline[0].id).toBe(decId);
  });
});
