import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  isMonorepo,
  discoverWorkspaces,
  checkMonorepoFileDecisions,
  listAllMonorepoDecisions
} from '../src/core/monorepo.js';
import { initStorage, recordDecision } from '../src/core/store.js';

describe('Monorepo Support', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-monorepo-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects monorepo from package.json workspaces array', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'my-monorepo',
        workspaces: ['packages/*']
      })
    );

    expect(isMonorepo(tempDir)).toBe(true);
  });

  it('discovers workspace packages accurately', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'root',
        workspaces: ['packages/*']
      })
    );

    const pkgADir = path.join(tempDir, 'packages/pkg-a');
    const pkgBDir = path.join(tempDir, 'packages/pkg-b');
    fs.mkdirSync(pkgADir, { recursive: true });
    fs.mkdirSync(pkgBDir, { recursive: true });

    fs.writeFileSync(
      path.join(pkgADir, 'package.json'),
      JSON.stringify({ name: '@monorepo/pkg-a' })
    );
    fs.writeFileSync(
      path.join(pkgBDir, 'package.json'),
      JSON.stringify({ name: '@monorepo/pkg-b' })
    );

    const workspaces = discoverWorkspaces(tempDir);
    expect(workspaces.length).toBe(2);
    expect(workspaces.map((w) => w.name).sort()).toEqual(['@monorepo/pkg-a', '@monorepo/pkg-b']);
  });

  it('package-level decisions take precedence over root decisions', () => {
    // 1. Root structure
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'root',
        workspaces: ['packages/*']
      })
    );
    initStorage(tempDir);
    recordDecision(tempDir, {
      summary: 'Root architecture decision: use Winston',
      rationale: 'Root logger standard',
      scope: ['packages/**'],
      author: 'root-architect'
    });

    // 2. Package A with its own .decisions/
    const pkgADir = path.join(tempDir, 'packages/pkg-a');
    fs.mkdirSync(pkgADir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgADir, 'package.json'),
      JSON.stringify({ name: '@monorepo/pkg-a' })
    );

    initStorage(pkgADir);
    recordDecision(pkgADir, {
      summary: 'Package A overrides logger: use Pino',
      rationale: 'Need zero overhead in pkg-a',
      scope: ['src/**/*.ts'],
      author: 'pkg-a-lead'
    });

    // Check decisions for file in pkg-a: packages/pkg-a/src/index.ts
    const matches = checkMonorepoFileDecisions(tempDir, 'packages/pkg-a/src/index.ts');

    // Both match, but package-level decision comes first (origin: 'package')
    expect(matches.length).toBe(2);
    expect(matches[0].origin).toBe('package');
    expect(matches[0].packageName).toBe('@monorepo/pkg-a');
    expect(matches[0].summary).toContain('Pino');

    expect(matches[1].origin).toBe('root');
    expect(matches[1].summary).toContain('Winston');
  });

  it('lists all decisions across root and packages', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ workspaces: ['packages/*'] })
    );
    initStorage(tempDir);
    recordDecision(tempDir, {
      summary: 'Root decision',
      rationale: 'All repo',
      scope: ['**/*']
    });

    const pkgDir = path.join(tempDir, 'packages/core');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'core-pkg' })
    );
    initStorage(pkgDir);
    recordDecision(pkgDir, {
      summary: 'Core pkg decision',
      rationale: 'Core only',
      scope: ['src/**/*']
    });

    const all = listAllMonorepoDecisions(tempDir);
    expect(all.length).toBe(2);
    expect(all.some((d) => d.origin === 'root')).toBe(true);
    expect(all.some((d) => d.origin === 'package' && d.packageName === 'core-pkg')).toBe(true);
  });
});
