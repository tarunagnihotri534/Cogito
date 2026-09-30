import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initStorage,
  record,
  check,
  list,
  get,
  search,
  doctor,
  lint,
  getTimeline,
  DecisionStore,
  isMonorepo,
  extractImports
} from '../src/index.js';

describe('Programmatic API', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-api-test-'));
    initStorage(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('provides convenient top-level functions and aliases', () => {
    // 1. record
    const dec = record(tempDir, {
      summary: 'API Test Decision',
      rationale: 'Testing programmatic interface',
      scope: ['src/**/*.ts'],
      tags: ['test', 'api']
    });
    expect(dec.id).toMatch(/^dec_/);

    // 2. get
    const fetched = get(tempDir, dec.id);
    expect(fetched?.summary).toBe('API Test Decision');

    // 3. check
    const matches = check(tempDir, 'src/index.ts');
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe(dec.id);

    // 4. list
    const items = list(tempDir);
    expect(items.length).toBe(1);

    // 5. search
    const searchResults = search(tempDir, 'programmatic');
    expect(searchResults.length).toBe(1);

    // 6. doctor
    const docReport = doctor({ baseDir: tempDir });
    expect(docReport).toHaveProperty('healthy');

    // 7. lint
    const lintRes = lint(tempDir);
    expect(lintRes.valid).toBe(true);

    // 8. getTimeline
    const timeline = getTimeline(tempDir, dec.id);
    expect(timeline.length).toBe(1);

    // 9. utility exports
    expect(typeof isMonorepo).toBe('function');
    expect(typeof extractImports).toBe('function');
  });

  it('DecisionStore provides stateful wrapper over repository', async () => {
    const store = new DecisionStore(tempDir);
    expect((await store.list()).length).toBe(0);

    const d = await store.record({
      summary: 'Stateful store decision',
      rationale: 'Object-oriented abstraction',
      scope: ['lib/**']
    });

    expect((await store.list()).length).toBe(1);
    expect((await store.get(d.id))?.summary).toBe('Stateful store decision');
    expect((await store.check('lib/core.ts')).length).toBe(1);
  });
});
