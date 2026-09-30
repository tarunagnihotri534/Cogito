import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { lintDecisions } from '../src/core/lint.js';
import { initStorage, recordDecision } from '../src/core/store.js';

describe('Feature 6: Lint and Schema Validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-lint-test-'));
    initStorage(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('validates a repository with properly structured decisions', () => {
    recordDecision(tmpDir, {
      summary: 'Use TypeScript strict mode',
      rationale: 'Catch type errors at build time',
      scope: ['src/**/*.ts'],
      tags: ['typescript']
    });

    const res = lintDecisions(tmpDir);
    expect(res.valid).toBe(true);
    expect(res.totalFiles).toBe(1);
    expect(res.errors.length).toBe(0);
  });

  it('flags missing required fields (summary, rationale)', () => {
    const brokenFile = path.join(tmpDir, '.decisions', 'active', 'broken.md');
    fs.writeFileSync(
      brokenFile,
      '---\nid: dec_test_001\nstatus: active\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Broken',
      'utf8'
    );

    const res = lintDecisions(tmpDir);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'summary')).toBe(true);
    expect(res.errors.some((e) => e.field === 'rationale')).toBe(true);
  });

  it('flags status mismatch between frontmatter and folder location', () => {
    const mismatchFile = path.join(tmpDir, '.decisions', 'active', 'mismatch.md');
    fs.writeFileSync(
      mismatchFile,
      '---\nid: dec_test_002\nsummary: Mismatched status\nrationale: Testing mismatch\nstatus: superseded\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Mismatch',
      'utf8'
    );

    const res = lintDecisions(tmpDir);
    expect(res.valid).toBe(false);
    const statusErr = res.errors.find((e) => e.field === 'status');
    expect(statusErr?.message).toContain('does not match parent directory');
  });

  it('flags duplicate decision IDs across folders', () => {
    recordDecision(tmpDir, {
      summary: 'Decision 1',
      rationale: 'Rationale 1',
      scope: ['src/**/*']
    });

    // Read the recorded ID
    const activeFiles = fs.readdirSync(path.join(tmpDir, '.decisions', 'active'));
    const content = fs.readFileSync(path.join(tmpDir, '.decisions', 'active', activeFiles[0]), 'utf8');

    // Duplicate in superseded folder
    const dupFile = path.join(tmpDir, '.decisions', 'superseded', 'duplicate.md');
    fs.writeFileSync(dupFile, content.replace('status: active', 'status: superseded'), 'utf8');

    const res = lintDecisions(tmpDir);
    expect(res.valid).toBe(false);
    const dupErr = res.errors.find((e) => e.field === 'id' && e.message.includes('Duplicate decision ID'));
    expect(dupErr).toBeDefined();
  });

  it('checks published schema/decision.schema.json exists and is valid JSON', () => {
    const schemaFile = path.resolve(__dirname, '../schema/decision.schema.json');
    expect(fs.existsSync(schemaFile)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    expect(schema.title).toBe('DecisionFrontmatter');
    expect(schema.required).toContain('id');
    expect(schema.required).toContain('summary');
    expect(schema.required).toContain('rationale');
  });
});
