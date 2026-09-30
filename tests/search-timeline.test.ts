import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { searchDecisions } from '../src/core/search.js';
import { getDecisionTimeline } from '../src/core/timeline.js';
import { initStorage, recordDecision, updateDecisionStatus } from '../src/core/store.js';

describe('Feature 7: Search and Supersession Timeline', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-search-test-'));
    initStorage(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Full-text Decision Search', () => {
    beforeEach(() => {
      recordDecision(tmpDir, {
        summary: 'Adopt PostgreSQL for transactional persistence',
        rationale: 'ACID transactions and mature indexing',
        scope: ['src/db/**/*.ts'],
        tags: ['database', 'persistence', 'postgres']
      });

      recordDecision(tmpDir, {
        summary: 'Use Redis for distributed caching',
        rationale: 'Sub-millisecond latency for session data',
        scope: ['src/cache/**/*.ts'],
        tags: ['cache', 'redis', 'performance']
      });

      recordDecision(tmpDir, {
        summary: 'Enforce JWT bearer authentication',
        rationale: 'Stateless auth for microservices',
        scope: ['src/auth/**/*.ts'],
        tags: ['auth', 'security']
      });
    });

    it('searches decisions by keyword with relevance ranking', () => {
      const results = searchDecisions(tmpDir, 'PostgreSQL persistence');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.summary).toContain('PostgreSQL');
      expect(results[0].matchedFields).toContain('summary');
      expect(results[0].matchedFields).toContain('tags');
    });

    it('searches by tag and scope', () => {
      const tagResults = searchDecisions(tmpDir, 'security');
      expect(tagResults.length).toBe(1);
      expect(tagResults[0].item.summary).toContain('JWT');

      const scopeResults = searchDecisions(tmpDir, 'cache');
      expect(scopeResults.length).toBe(1);
      expect(scopeResults[0].item.summary).toContain('Redis');
    });

    it('returns empty array when query does not match any decision', () => {
      const results = searchDecisions(tmpDir, 'nonexistentterm12345');
      expect(results.length).toBe(0);
    });
  });

  describe('Supersession Timeline Traversal', () => {
    it('traverses supersession chain from ancestor to descendant', () => {
      // 1. Original decision
      const d1 = recordDecision(tmpDir, {
        summary: 'Use SQLite for local storage',
        rationale: 'Quick prototype setup',
        scope: ['src/db/**/*']
      });

      // 2. Second decision superseding d1
      const d2 = recordDecision(tmpDir, {
        summary: 'Migrate from SQLite to MySQL',
        rationale: 'Support concurrency',
        scope: ['src/db/**/*'],
        supersedes: d1.id
      });

      // 3. Third decision superseding d2
      const d3 = recordDecision(tmpDir, {
        summary: 'Standardize on PostgreSQL',
        rationale: 'ACID and JSON support',
        scope: ['src/db/**/*'],
        supersedes: d2.id
      });

      // Timeline from middle node d2
      const timeline2 = getDecisionTimeline(tmpDir, d2.id);
      expect(timeline2.length).toBe(3);
      expect(timeline2[0].id).toBe(d1.id);
      expect(timeline2[1].id).toBe(d2.id);
      expect(timeline2[2].id).toBe(d3.id);

      // Timeline from origin node d1
      const timeline1 = getDecisionTimeline(tmpDir, d1.id);
      expect(timeline1.length).toBe(3);
      expect(timeline1[0].id).toBe(d1.id);
      expect(timeline1[2].id).toBe(d3.id);

      // Timeline from newest node d3
      const timeline3 = getDecisionTimeline(tmpDir, d3.id);
      expect(timeline3.length).toBe(3);
      expect(timeline3[0].id).toBe(d1.id);
      expect(timeline3[2].id).toBe(d3.id);
    });

    it('returns single node for decision with no supersession history', () => {
      const standalone = recordDecision(tmpDir, {
        summary: 'Standalone Decision',
        rationale: 'No supersession',
        scope: ['src/**/*']
      });

      const timeline = getDecisionTimeline(tmpDir, standalone.id);
      expect(timeline.length).toBe(1);
      expect(timeline[0].id).toBe(standalone.id);
    });

    it('returns empty array for nonexistent decision ID', () => {
      const timeline = getDecisionTimeline(tmpDir, 'dec_does_not_exist');
      expect(timeline.length).toBe(0);
    });
  });
});
