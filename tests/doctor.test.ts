import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runDoctor, collectRepoFiles } from '../src/core/doctor.js';
import { initStorage, recordDecision } from '../src/core/store.js';

describe('Feature 4: Staleness Detection (decision-tracker doctor)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-doctor-test-'));
    initStorage(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('collects repository files excluding internal folders', () => {
    fs.mkdirSync(path.join(tmpDir, 'src', 'db'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'db', 'client.ts'), '// client', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test', 'utf8');

    const files = collectRepoFiles(tmpDir);
    expect(files).toContain('src/db/client.ts');
    expect(files).toContain('README.md');
    expect(files.some((f) => f.includes('.decisions'))).toBe(false);
  });

  it('detects dead globs matching zero files in repository', () => {
    // Decision with a scope that does not exist
    recordDecision(tmpDir, {
      summary: 'Legacy XML parser settings',
      rationale: 'Old parser constraint',
      scope: ['src/legacy/xml/**/*.ts']
    });

    const report = runDoctor({ baseDir: tmpDir, skipGit: true });
    expect(report.healthy).toBe(false);

    const deadGlobIssue = report.issues.find((i) => i.type === 'dead_glob');
    expect(deadGlobIssue).toBeDefined();
    expect(deadGlobIssue?.severity).toBe('warning');
    expect(deadGlobIssue?.message).toContain("matches 0 files in repository");
  });

  it('detects expired and invalid reviewBy dates', () => {
    // 1. Expired date
    recordDecision(tmpDir, {
      summary: 'Temporary rate limiter',
      rationale: 'Protect beta endpoints',
      scope: ['src/api/**/*.ts'],
      reviewBy: '2020-01-01'
    });

    // 2. Invalid date format
    recordDecision(tmpDir, {
      summary: 'Invalid date decision',
      rationale: 'Testing invalid date',
      scope: ['src/api/**/*.ts'],
      reviewBy: 'not-a-real-date'
    });

    const report = runDoctor({ baseDir: tmpDir, skipGit: true });
    const expiredIssue = report.issues.find(
      (i) => i.type === 'expired_review' && i.details?.reviewBy === '2020-01-01'
    );
    expect(expiredIssue).toBeDefined();
    expect(expiredIssue?.message).toContain('expired');

    const invalidIssue = report.issues.find(
      (i) => i.type === 'expired_review' && i.details?.reviewBy === 'not-a-real-date'
    );
    expect(invalidIssue).toBeDefined();
    expect(invalidIssue?.severity).toBe('error');
    expect(invalidIssue?.message).toContain('Invalid reviewBy date format');
  });

  it('detects broken supersededBy links', () => {
    // Write a decision file with a nonexistent supersededBy target
    recordDecision(tmpDir, {
      summary: 'Orphaned superseded decision',
      rationale: 'Superseded by something that does not exist',
      scope: ['src/**/*.ts']
    });

    // Manually mutate index to introduce broken supersededBy
    const indexPath = path.join(tmpDir, '.decisions', 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    index[0].supersededBy = 'dec_nonexistent_999999';
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

    const report = runDoctor({ baseDir: tmpDir, skipGit: true });
    expect(report.healthy).toBe(false);

    const brokenLink = report.issues.find((i) => i.type === 'broken_superseded_by');
    expect(brokenLink).toBeDefined();
    expect(brokenLink?.severity).toBe('error');
    expect(brokenLink?.message).toContain('dec_nonexistent_999999');
  });

  it('reports healthy when active decisions have matching files and future reviewBy', () => {
    fs.mkdirSync(path.join(tmpDir, 'src', 'api'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'api', 'users.ts'), '// users', 'utf8');

    recordDecision(tmpDir, {
      summary: 'RESTful API conventions',
      rationale: 'Consistent endpoints',
      scope: ['src/api/**/*.ts'],
      reviewBy: '2099-12-31'
    });

    const report = runDoctor({ baseDir: tmpDir, skipGit: true });
    expect(report.healthy).toBe(true);
    expect(report.issues.length).toBe(0);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });
});
