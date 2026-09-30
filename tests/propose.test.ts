import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  parseTranscript,
  extractCandidates,
  scoreCandidate,
  loadInboxCandidates,
  saveInboxCandidate,
  removeInboxCandidate,
  approveInboxCandidate,
  ensureInboxIgnored,
  getInboxDir,
  proposeFromTranscript,
  reviewInboxSync,
  ProposedCandidate
} from '../src/core/propose/index.js';
import { handlePostToolUse, handleSessionEnd } from '../src/core/hooks/index.js';
import { initStorage, recordDecision, loadIndex } from '../src/core/store.js';

describe('Feature 1: Auto-capture & Review (propose, inbox, review, hooks)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-propose-test-'));
    initStorage(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Scoring Heuristic', () => {
    it('gives high confidence score (>= 0.75) to strong architectural decisions', () => {
      const score = scoreCandidate(
        'Use PostgreSQL for persistent storage',
        'We chose PostgreSQL instead of SQLite because ACID transactions and robust JSONB indexing are required for production scaling.',
        ['src/db/**/*.ts', 'prisma/schema.prisma']
      );
      expect(score).toBeGreaterThanOrEqual(0.75);
    });

    it('gives low confidence score (< 0.50) to trivial or short changes', () => {
      const score = scoreCandidate(
        'Fix lint error in utils',
        'Fixed typo.',
        []
      );
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('Transcript Parsing and Candidate Extraction', () => {
    it('parses JSONL transcript and extracts scored, scoped candidates capped at 5', () => {
      const transcriptFile = path.join(tmpDir, 'session-transcript.jsonl');
      const lines = [
        JSON.stringify({
          type: 'tool_use',
          name: 'Edit',
          input: { file_path: 'src/auth/jwt.ts' }
        }),
        JSON.stringify({
          role: 'user',
          content: 'Why should we use RS256 instead of HS256 for tokens?'
        }),
        JSON.stringify({
          role: 'assistant',
          content:
            'We decided to adopt RS256 asymmetric signing for JWTs because public key verification allows third-party services to validate tokens without exposing the private signing secret.'
        }),
        JSON.stringify({
          type: 'tool_use',
          name: 'Write',
          input: { file_path: 'src/db/cache.ts' }
        }),
        JSON.stringify({
          role: 'assistant',
          content:
            'Decision: Disable client-side caching for user sessions. Rationale: In order to prevent stale auth state after revocation, session profiles must always be fetched fresh.'
        })
      ];

      fs.writeFileSync(transcriptFile, lines.join('\n'), 'utf8');

      const result = proposeFromTranscript({
        baseDir: tmpDir,
        transcriptPath: transcriptFile,
        sessionId: 'test-session-001'
      });

      expect(result.savedCount).toBe(2);
      expect(result.proposed.length).toBe(2);

      const first = result.proposed.find((p) => p.summary.toLowerCase().includes('rs256'));
      expect(first).toBeDefined();
      expect(first!.rationale).toContain('public key verification');
      expect(first!.scope).toContain('src/auth/jwt.ts');
      expect(first!.score).toBeGreaterThanOrEqual(0.7);

      const inboxCandidates = loadInboxCandidates(tmpDir);
      expect(inboxCandidates.length).toBe(2);
    });

    it('deduplicates extracted candidates against existing active decisions', () => {
      // Record an existing active decision
      recordDecision(tmpDir, {
        summary: 'Use PostgreSQL for database',
        rationale: 'Existing rationale',
        scope: ['src/db/**/*.ts']
      });

      const transcriptFile = path.join(tmpDir, 'transcript-dup.jsonl');
      const lines = [
        JSON.stringify({
          role: 'assistant',
          content:
            'We decided to use PostgreSQL for database because relational ACID transactions are critical.'
        })
      ];
      fs.writeFileSync(transcriptFile, lines.join('\n'), 'utf8');

      const result = proposeFromTranscript({
        baseDir: tmpDir,
        transcriptPath: transcriptFile
      });

      // Should be deduplicated away
      expect(result.savedCount).toBe(0);
      expect(result.proposed.length).toBe(0);
    });
  });

  describe('Inbox Lifecycle & Gitignore', () => {
    it('ensures .decisions/.inbox/ is added to .gitignore', () => {
      ensureInboxIgnored(tmpDir);
      const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.decisions/.inbox/');

      // Calling again should be idempotent
      ensureInboxIgnored(tmpDir);
      const occurrences = gitignore.split('.decisions/.inbox/').length - 1;
      expect(occurrences).toBe(1);
    });

    it('saves, loads, removes, and approves inbox candidates', () => {
      const candidate: ProposedCandidate = {
        id: 'prop_20260212_inbox01',
        summary: 'Enforce UTC timestamps in API responses',
        rationale: 'We chose UTC formatting to eliminate timezone ambiguity across mobile clients.',
        scope: ['src/api/**/*.ts'],
        tags: ['api', 'datetime'],
        score: 0.85,
        confidence: 'suggested',
        created: new Date().toISOString(),
        source: {
          type: 'transcript',
          transcriptPath: 'test.jsonl'
        }
      };

      saveInboxCandidate(tmpDir, candidate);

      const loaded = loadInboxCandidates(tmpDir);
      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe('prop_20260212_inbox01');
      expect(loaded[0].summary).toBe('Enforce UTC timestamps in API responses');

      // Approve candidate with override
      const record = approveInboxCandidate(tmpDir, 'prop_20260212_inbox01', {
        summary: 'Standardize on ISO 8601 UTC timestamps'
      });

      expect(record).not.toBeNull();
      expect(record!.summary).toBe('Standardize on ISO 8601 UTC timestamps');
      expect(record!.status).toBe('active');

      // Should be removed from inbox
      const afterApproval = loadInboxCandidates(tmpDir);
      expect(afterApproval.length).toBe(0);

      // Should be in active index
      const active = loadIndex(tmpDir);
      expect(active.some((a) => a.summary === 'Standardize on ISO 8601 UTC timestamps')).toBe(true);
    });

    it('reviewInboxSync with --yes only accepts candidates above score threshold', () => {
      const highCandidate: ProposedCandidate = {
        id: 'prop_high',
        summary: 'High confidence architectural decision',
        rationale: 'Detailed trade-off rationale because we must prevent data loss.',
        scope: ['src/core/**/*'],
        tags: ['core'],
        score: 0.85,
        confidence: 'suggested',
        created: new Date().toISOString(),
        source: { type: 'transcript', transcriptPath: 't.jsonl' }
      };

      const lowCandidate: ProposedCandidate = {
        id: 'prop_low',
        summary: 'Low confidence change',
        rationale: 'Short rationale.',
        scope: [],
        tags: [],
        score: 0.55,
        confidence: 'suggested',
        created: new Date().toISOString(),
        source: { type: 'transcript', transcriptPath: 't.jsonl' }
      };

      saveInboxCandidate(tmpDir, highCandidate);
      saveInboxCandidate(tmpDir, lowCandidate);

      const reviewRes = reviewInboxSync({
        baseDir: tmpDir,
        yes: true,
        minScore: 0.75
      });

      expect(reviewRes.approved).toEqual(['prop_high']);
      expect(reviewRes.remaining).toEqual(['prop_low']);

      // High candidate should be approved and removed, low candidate remains in inbox
      const remainingInbox = loadInboxCandidates(tmpDir);
      expect(remainingInbox.length).toBe(1);
      expect(remainingInbox[0].id).toBe('prop_low');
    });
  });

  describe('Claude Code Hook Handlers', () => {
    it('handlePostToolUse returns systemMessage when edited file matches decision scope', () => {
      recordDecision(tmpDir, {
        summary: 'Keep auth module synchronous',
        rationale: 'Preserves backward compatibility with legacy consumers',
        scope: ['src/auth/**/*.ts'],
        tags: ['auth']
      });

      const res = handlePostToolUse(tmpDir, {
        tool_name: 'Edit',
        tool_input: {
          file_path: 'src/auth/session.ts'
        }
      });

      expect(res.matchedCount).toBe(1);
      expect(res.systemMessage).toContain('Advisory: 1 existing architectural decision(s)');
      expect(res.systemMessage).toContain('Keep auth module synchronous');
    });

    it('handlePostToolUse returns empty when no decisions match', () => {
      const res = handlePostToolUse(tmpDir, {
        tool_name: 'Edit',
        tool_input: {
          file_path: 'public/images/logo.png'
        }
      });

      expect(res.matchedCount).toBe(0);
      expect(res.systemMessage).toBeUndefined();
    });

    it('handleSessionEnd extracts candidates and writes to inbox silently', () => {
      const transcriptFile = path.join(tmpDir, 'end-session.jsonl');
      fs.writeFileSync(
        transcriptFile,
        JSON.stringify({
          role: 'assistant',
          content:
            'We chose to adopt React Server Components because initial page load bundle size is reduced by 60%.'
        }),
        'utf8'
      );

      const res = handleSessionEnd(tmpDir, {
        hook_event_name: 'SessionEnd',
        transcript_path: transcriptFile,
        session_id: 'sess_123'
      });

      expect(res.proposedCount).toBe(1);
      expect(res.candidateIds.length).toBe(1);

      const inbox = loadInboxCandidates(tmpDir);
      expect(inbox.length).toBe(1);
      expect(inbox[0].summary).toContain('React Server Components');
    });
  });
});
