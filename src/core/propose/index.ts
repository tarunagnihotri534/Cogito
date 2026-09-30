import { loadIndex } from '../store.js';
import {
  parseTranscript,
  extractCandidates,
  scoreCandidate,
  type ParsedTranscript
} from './transcript.js';
import {
  loadInboxCandidates,
  saveInboxCandidate,
  removeInboxCandidate,
  approveInboxCandidate,
  ensureInboxIgnored,
  getInboxDir,
  type ProposedCandidate
} from './inbox.js';

export interface ProposeOptions {
  baseDir?: string;
  transcriptPath: string;
  sessionId?: string;
  maxCandidates?: number;
}

export interface ProposeResult {
  transcriptPath: string;
  proposed: ProposedCandidate[];
  savedCount: number;
}

export function proposeFromTranscript(options: ProposeOptions): ProposeResult {
  const baseDir = options.baseDir || process.cwd();
  const transcript = parseTranscript(options.transcriptPath);
  const existingDecisions = loadIndex(baseDir);

  const candidates = extractCandidates(
    transcript,
    existingDecisions,
    options.transcriptPath,
    options.sessionId
  );

  const max = options.maxCandidates ?? 5;
  const topCandidates = candidates.slice(0, max);

  let savedCount = 0;
  for (const cand of topCandidates) {
    saveInboxCandidate(baseDir, cand);
    savedCount++;
  }

  return {
    transcriptPath: options.transcriptPath,
    proposed: topCandidates,
    savedCount
  };
}

export interface ReviewOptions {
  baseDir?: string;
  yes?: boolean;
  minScore?: number;
  listOnly?: boolean;
}

export interface ReviewResult {
  total: number;
  approved: string[];
  rejected: string[];
  remaining: string[];
}

export function reviewInboxSync(options: ReviewOptions): ReviewResult {
  const baseDir = options.baseDir || process.cwd();
  const minScore = options.minScore ?? 0.75;
  const candidates = loadInboxCandidates(baseDir);

  const result: ReviewResult = {
    total: candidates.length,
    approved: [],
    rejected: [],
    remaining: []
  };

  if (options.yes) {
    for (const cand of candidates) {
      if (cand.score >= minScore) {
        approveInboxCandidate(baseDir, cand.id);
        result.approved.push(cand.id);
      } else {
        result.remaining.push(cand.id);
      }
    }
  }

  return result;
}

export {
  parseTranscript,
  extractCandidates,
  scoreCandidate,
  loadInboxCandidates,
  saveInboxCandidate,
  removeInboxCandidate,
  approveInboxCandidate,
  ensureInboxIgnored,
  getInboxDir
};

export type {
  ProposedCandidate,
  ParsedTranscript
};
