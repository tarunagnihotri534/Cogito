import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initStorage,
  recordDecision,
  checkFileDecisions,
  listDecisions,
  getDecision,
  updateDecisionStatus,
  loadIndex
} from '../src/core/store.js';

describe('Decision Memory Store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should initialize storage structure and index.json', () => {
    const { decisionsDir } = initStorage(tmpDir);
    expect(fs.existsSync(decisionsDir)).toBe(true);
    expect(fs.existsSync(path.join(decisionsDir, 'active'))).toBe(true);
    expect(fs.existsSync(path.join(decisionsDir, 'superseded'))).toBe(true);
    expect(fs.existsSync(path.join(decisionsDir, 'archived'))).toBe(true);
    expect(fs.existsSync(path.join(decisionsDir, 'index.json'))).toBe(true);

    const index = loadIndex(tmpDir);
    expect(index).toEqual([]);
  });

  it('should record a new decision and update index.json', () => {
    const record = recordDecision(tmpDir, {
      summary: 'Use synchronous payment processor',
      rationale: 'Prevent race conditions in checkout flow',
      scope: ['src/api/payments/**/*.ts', 'src/controllers/checkout.ts'],
      tags: ['payments', 'architecture'],
      author: 'alice',
      confidence: 'explicit',
      context: 'Historical duplicate charges bug',
      consequences: 'Latency increases slightly under high load'
    });

    expect(record.id).toMatch(/^dec_\d{8}_/);
    expect(record.summary).toBe('Use synchronous payment processor');
    expect(record.status).toBe('active');
    expect(fs.existsSync(path.resolve(tmpDir, record.filePath))).toBe(true);

    const index = loadIndex(tmpDir);
    expect(index.length).toBe(1);
    expect(index[0].id).toBe(record.id);
  });

  it('should correctly match file paths against decision glob scopes', () => {
    recordDecision(tmpDir, {
      summary: 'Strict auth token verification',
      rationale: 'Enforce JWT check on all auth routes',
      scope: ['src/api/auth/**/*.ts', 'src/middleware/auth.ts'],
      tags: ['security', 'auth'],
      author: 'bob',
      confidence: 'explicit'
    });

    const match1 = checkFileDecisions(tmpDir, 'src/api/auth/login.ts');
    expect(match1.length).toBe(1);
    expect(match1[0].summary).toBe('Strict auth token verification');

    const match2 = checkFileDecisions(tmpDir, 'src/middleware/auth.ts');
    expect(match2.length).toBe(1);

    const match3 = checkFileDecisions(tmpDir, 'src/api/payments/checkout.ts');
    expect(match3.length).toBe(0);
  });

  it('should list decisions with status and tag filters', () => {
    recordDecision(tmpDir, {
      summary: 'Decision 1',
      rationale: 'Rationale 1',
      scope: ['src/**/*.ts'],
      tags: ['database']
    });

    recordDecision(tmpDir, {
      summary: 'Decision 2',
      rationale: 'Rationale 2',
      scope: ['src/**/*.ts'],
      tags: ['frontend']
    });

    const dbDecisions = listDecisions(tmpDir, { tags: ['database'] });
    expect(dbDecisions.length).toBe(1);
    expect(dbDecisions[0].summary).toBe('Decision 1');
  });

  it('should support superseding an existing decision', () => {
    const oldDec = recordDecision(tmpDir, {
      summary: 'Legacy Auth System',
      rationale: 'Initial implementation',
      scope: ['src/auth/**/*.ts'],
      tags: ['auth']
    });

    const newDec = recordDecision(tmpDir, {
      summary: 'OAuth 2.0 Integration',
      rationale: 'Replaces legacy auth',
      scope: ['src/auth/**/*.ts'],
      tags: ['auth'],
      supersedes: oldDec.id
    });

    const oldRecord = getDecision(tmpDir, oldDec.id);
    expect(oldRecord?.status).toBe('superseded');
    expect(oldRecord?.supersededBy).toBe(newDec.id);

    const activeMatches = checkFileDecisions(tmpDir, 'src/auth/login.ts');
    expect(activeMatches.length).toBe(1);
    expect(activeMatches[0].id).toBe(newDec.id);
  });

  it('should move files when updating decision status', () => {
    const dec = recordDecision(tmpDir, {
      summary: 'Experimental Feature',
      rationale: 'Testing prototype',
      scope: ['src/experiments/*.ts'],
      tags: ['test']
    });

    updateDecisionStatus(tmpDir, dec.id, 'archived');
    const updated = getDecision(tmpDir, dec.id);

    expect(updated?.status).toBe('archived');
    expect(updated?.filePath).toContain('archived');
  });
});
