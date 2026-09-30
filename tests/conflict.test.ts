import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectConflicts, checkScopeOverlap } from '../src/core/conflict.js';
import { initStorage, recordDecision } from '../src/core/store.js';

describe('Feature 5: Conflict and Overlap Detection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-conflict-test-'));
    initStorage(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects scope pattern overlaps accurately', () => {
    const overlaps1 = checkScopeOverlap(['src/db/**/*.ts'], ['src/db/**/*.ts']);
    expect(overlaps1.length).toBeGreaterThan(0);

    const overlaps2 = checkScopeOverlap(['src/db/client.ts'], ['src/db/**/*.ts']);
    expect(overlaps2.length).toBeGreaterThan(0);

    const overlaps3 = checkScopeOverlap(['src/api/**/*.ts'], ['tests/**/*.ts']);
    expect(overlaps3.length).toBe(0);
  });

  it('detects conflict between new decision and existing active decision with overlapping scope and tags', () => {
    recordDecision(tmpDir, {
      summary: 'Use PostgreSQL connection pool',
      rationale: 'Prevent socket exhaustion',
      scope: ['src/db/**/*.ts'],
      tags: ['database', 'postgres']
    });

    const warnings = detectConflicts(tmpDir, {
      summary: 'Switch to SQLite in-memory database',
      scope: ['src/db/client.ts'],
      tags: ['database', 'sqlite']
    });

    expect(warnings.length).toBe(1);
    expect(warnings[0].existingSummary).toBe('Use PostgreSQL connection pool');
    expect(warnings[0].overlappingTags).toContain('database');
    expect(warnings[0].reason).toContain('Overlapping file scope');
  });

  it('detects conflict with overlapping scope and similar summary keywords without tags', () => {
    recordDecision(tmpDir, {
      summary: 'Authenticate requests using JWT tokens',
      rationale: 'Stateless auth',
      scope: ['src/auth/**/*.ts']
    });

    const warnings = detectConflicts(tmpDir, {
      summary: 'Authenticate requests using session cookies',
      scope: ['src/auth/**/*.ts']
    });

    expect(warnings.length).toBe(1);
    expect(warnings[0].existingSummary).toBe('Authenticate requests using JWT tokens');
    expect(warnings[0].reason).toContain('Similar architectural focus');
  });

  it('returns no conflict when scopes do not overlap', () => {
    recordDecision(tmpDir, {
      summary: 'Use PostgreSQL connection pool',
      rationale: 'DB persistence',
      scope: ['src/db/**/*.ts'],
      tags: ['database']
    });

    const warnings = detectConflicts(tmpDir, {
      summary: 'Use Redis for caching',
      scope: ['src/cache/**/*.ts'],
      tags: ['cache']
    });

    expect(warnings.length).toBe(0);
  });

  it('ignores superseded decisions when checking for conflicts', () => {
    recordDecision(tmpDir, {
      summary: 'Old database choice',
      rationale: 'Old rationale',
      scope: ['src/db/**/*.ts'],
      status: 'superseded',
      tags: ['database']
    });

    const warnings = detectConflicts(tmpDir, {
      summary: 'New database choice',
      scope: ['src/db/**/*.ts'],
      tags: ['database']
    });

    expect(warnings.length).toBe(0);
  });
});
