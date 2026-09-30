import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  extractImports,
  LocalKeywordSemanticMatcher,
  matchFileSemantically
} from '../src/core/semantic.js';
import { initStorage, recordDecision } from '../src/core/store.js';

describe('Local Semantic Analysis', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-semantic-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('extractImports', () => {
    it('extracts ES import statements', () => {
      const code = `
        import express from 'express';
        import { z } from 'zod';
        import type { Request } from 'express';
        import defaultExport from "@scope/package/subpath";
      `;

      const imports = extractImports(code);
      expect(imports).toContain('express');
      expect(imports).toContain('zod');
      expect(imports).toContain('@scope/package/subpath');
    });

    it('extracts CommonJS require statements', () => {
      const code = `
        const fs = require('fs');
        const path = require("path");
        const helper = require('./utils/helper.js');
      `;

      const imports = extractImports(code);
      expect(imports).toContain('fs');
      expect(imports).toContain('path');
      expect(imports).toContain('./utils/helper.js');
    });
  });

  describe('LocalKeywordSemanticMatcher', () => {
    it('matches file when imported package corresponds to decision tags', () => {
      initStorage(tempDir);
      const dec = recordDecision(tempDir, {
        summary: 'Standardize on PostgreSQL with Prisma',
        rationale: 'Robust type-safe ORM and ACID guarantees',
        scope: ['src/db/**'],
        tags: ['prisma', 'database', 'postgres']
      });

      const fileContent = `
        import { PrismaClient } from '@prisma/client';
        export const prisma = new PrismaClient();
      `;

      const matcher = new LocalKeywordSemanticMatcher();
      const match = matcher.match('src/services/user.ts', fileContent, dec);

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThanOrEqual(0.4);
      expect(match!.matchedImports).toContain('@prisma/client');
    });

    it('matches file when architectural keywords in summary occur in file content', () => {
      initStorage(tempDir);
      const dec = recordDecision(tempDir, {
        summary: 'Implement event-driven Kafka messaging with dead-letter queue',
        rationale: 'Async decoupling across microservices',
        scope: ['src/events/**'],
        tags: ['messaging']
      });

      const fileContent = `
        // Setup Kafka producer and dead-letter handling
        function publishMessage(topic, payload) {
          console.log("Publishing to kafka messaging queue");
        }
      `;

      const matcher = new LocalKeywordSemanticMatcher();
      const match = matcher.match('src/handlers/order.ts', fileContent, dec);

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('matchFileSemantically', () => {
    it('scans active decisions and returns scored matches offline', () => {
      initStorage(tempDir);
      recordDecision(tempDir, {
        summary: 'Always use Zod for runtime API validation',
        rationale: 'Schema validation at boundary prevents corrupt state',
        scope: ['src/routes/**'],
        tags: ['zod', 'validation']
      });

      const testFilePath = path.join(tempDir, 'src/api/handler.ts');
      fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
      fs.writeFileSync(
        testFilePath,
        `
          import { z } from 'zod';
          const UserSchema = z.object({ id: z.string() });
        `
      );

      const matches = matchFileSemantically(tempDir, 'src/api/handler.ts');
      expect(matches.length).toBe(1);
      expect(matches[0].decision.summary).toContain('Zod');
      expect(matches[0].score).toBeGreaterThanOrEqual(0.4);
    });

    it('returns empty array if file does not exist', () => {
      initStorage(tempDir);
      const matches = matchFileSemantically(tempDir, 'nonexistent.ts');
      expect(matches).toEqual([]);
    });
  });
});
