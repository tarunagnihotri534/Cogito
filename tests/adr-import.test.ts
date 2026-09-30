import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { importAdrs, parseAdrContent } from '../src/core/importers/adr.js';
import { loadIndex, initStorage, getDecision } from '../src/core/store.js';

describe('ADR Import Core & Integration Tests', () => {
  let tmpDir: string;
  const fixturesDir = path.resolve(__dirname, 'fixtures/adrs');
  const tsxCliPath = path.resolve(__dirname, '../src/cli/index.ts');
  const localTsxBin = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-adr-test-'));
    initStorage(tmpDir);
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

  it('should parse Nygard ADR format and infer needs-scope when no paths present', () => {
    const filePath = path.join(fixturesDir, '0001-record-architecture-decisions.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseAdrContent(filePath, content);

    expect(parsed.summary).toBe('Record architecture decisions');
    expect(parsed.status).toBe('active');
    expect(parsed.needsScope).toBe(true);
    expect(parsed.scope).toEqual([]);
    expect(parsed.tags).toContain('needs-scope');
    expect(parsed.tags).toContain('adr');
  });

  it('should use explicit default-scope when passed', () => {
    const filePath = path.join(fixturesDir, '0001-record-architecture-decisions.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseAdrContent(filePath, content, 'src/docs/**/*');

    expect(parsed.needsScope).toBe(false);
    expect(parsed.scope).toEqual(['src/docs/**/*']);
    expect(parsed.tags).not.toContain('needs-scope');
  });

  it('should parse MADR format with section extraction and scope inference', () => {
    const filePath = path.join(fixturesDir, '0002-use-madr.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseAdrContent(filePath, content);

    expect(parsed.summary).toBe('Use Markdown Architectural Decision Records (MADR)');
    expect(parsed.status).toBe('active');
    expect(parsed.author).toBe('Alice, Bob');
    expect(parsed.rationale).toContain('MADR');
    expect(parsed.consequences).toContain('Standardized structure');
    expect(parsed.needsScope).toBe(false);
    expect(parsed.scope).toContain('src/templates/*.ts');
    expect(parsed.scope).toContain('src/core/**/*');
  });

  it('should parse messy ADR format with informal status and backtick paths', () => {
    const filePath = path.join(fixturesDir, '0003-messy-adr.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseAdrContent(filePath, content);

    expect(parsed.summary).toBe('Authentication and Session Management');
    expect(parsed.status).toBe('active');
    expect(parsed.author).toBe('SecTeam');
    expect(parsed.scope).toContain('src/auth/**/*.ts');
    expect(parsed.scope).toContain('src/middleware/auth.ts');
  });

  it('should import full ADR directory with idempotency and supersession resolution', async () => {
    const result = await importAdrs(tmpDir, {
      dir: fixturesDir
    });

    expect(result.totalFound).toBe(6);
    expect(result.imported.length).toBe(6);
    expect(result.skipped.length).toBe(0);
    expect(result.supersededCount).toBeGreaterThanOrEqual(1);

    const index = loadIndex(tmpDir);
    expect(index.length).toBe(6);

    // Verify status mapping: 0006 is rejected => archived
    const rejectedItem = index.find((i) => i.summary.includes('Reject Vue'));
    expect(rejectedItem?.status).toBe('archived');

    // Verify supersession link: 0004 superseded by 0005
    const sqliteItem = index.find((i) => i.summary.includes('Use SQLite'));
    const postgresItem = index.find((i) => i.summary.includes('PostgreSQL'));
    expect(sqliteItem?.status).toBe('superseded');
    expect(sqliteItem?.supersededBy).toBe(postgresItem?.id);

    // Verify source frontmatter metadata
    const postgresRecord = getDecision(tmpDir, postgresItem!.id);
    expect(postgresRecord?.source?.type).toBe('adr');
    expect(postgresRecord?.source?.hash).toBeDefined();

    // Idempotency: Re-running import should skip all unchanged files without creating duplicates
    const rerunResult = await importAdrs(tmpDir, {
      dir: fixturesDir
    });

    expect(rerunResult.imported.length).toBe(0);
    expect(rerunResult.skipped.length).toBe(6);

    const indexAfterRerun = loadIndex(tmpDir);
    expect(indexAfterRerun.length).toBe(6);
  });

  it('should support --dry-run without creating files on disk', async () => {
    const result = await importAdrs(tmpDir, {
      dir: fixturesDir,
      dryRun: true
    });

    expect(result.imported.length).toBe(6);
    expect(result.supersededCount).toBeGreaterThanOrEqual(1);

    // Verify no decision files were written
    const index = loadIndex(tmpDir);
    expect(index.length).toBe(0);
  });

  it('should execute import command via CLI and output JSON', () => {
    const out = runCli(`import --from adr "${fixturesDir}" --json`);
    const json = JSON.parse(out);

    expect(json.totalFound).toBe(6);
    expect(json.imported.length).toBe(6);
    expect(json.supersededCount).toBeGreaterThanOrEqual(1);

    // Verify decisions were stored
    const listOut = runCli('list --json');
    const listJson = JSON.parse(listOut);
    expect(listJson.length).toBe(6);
  });

  it('should fail with error if unsupported format or directory does not exist', () => {
    expect(() => {
      runCli(`import --from unsupported "${fixturesDir}"`);
    }).toThrow();

    expect(() => {
      runCli(`import --from adr "nonexistent/directory/path"`);
    }).toThrow();
  });
});
