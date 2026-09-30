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
});
