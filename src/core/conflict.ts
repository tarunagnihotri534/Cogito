import { loadIndex, normalizePath, slugify } from './store.js';
import { minimatch } from 'minimatch';

export interface ConflictWarning {
  existingId: string;
  existingSummary: string;
  existingScope: string[];
  overlappingScopePatterns: string[];
  overlappingTags: string[];
  reason: string;
}

export interface CandidateDecisionInput {
  summary: string;
  scope: string[];
  tags?: string[];
  rationale?: string;
  id?: string;
}

export function checkScopeOverlap(patterns1: string[], patterns2: string[]): string[] {
  const overlapping: string[] = [];

  for (const p1 of patterns1) {
    const norm1 = normalizePath(p1);
    for (const p2 of patterns2) {
      const norm2 = normalizePath(p2);

      // 1. Exact match
      if (norm1 === norm2) {
        overlapping.push(norm1);
        continue;
      }

      // 2. One pattern matches the other or vice-versa
      if (
        minimatch(norm1, norm2, { dot: true }) ||
        minimatch(norm2, norm1, { dot: true })
      ) {
        overlapping.push(`${norm1} ~ ${norm2}`);
        continue;
      }

      // 3. Common directory prefix for wildcards
      const baseDir1 = norm1.replace(/\/\*\*?.*$/, '');
      const baseDir2 = norm2.replace(/\/\*\*?.*$/, '');
      if (
        baseDir1 &&
        baseDir2 &&
        (baseDir1 === baseDir2 ||
          baseDir1.startsWith(baseDir2 + '/') ||
          baseDir2.startsWith(baseDir1 + '/'))
      ) {
        overlapping.push(`${norm1} ∩ ${norm2}`);
      }
    }
  }

  return Array.from(new Set(overlapping));
}

export function detectConflicts(
  baseDir: string = process.cwd(),
  newDecision: CandidateDecisionInput
): ConflictWarning[] {
  const allDecisions = loadIndex(baseDir);
  const activeDecisions = allDecisions.filter(
    (d) => d.status === 'active' && (!newDecision.id || d.id !== newDecision.id)
  );

  const warnings: ConflictWarning[] = [];
  const newTags = (newDecision.tags || []).map((t) => t.toLowerCase());
  const newWords = new Set(
    newDecision.summary
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  for (const existing of activeDecisions) {
    // 1. Check scope overlap
    const overlappingPatterns = checkScopeOverlap(newDecision.scope || [], existing.scope || []);
    if (overlappingPatterns.length === 0) {
      continue;
    }

    // 2. Check tag overlap
    const existingTags = (existing.tags || []).map((t) => t.toLowerCase());
    const commonTags = newTags.filter((t) => existingTags.includes(t));

    // 3. Check summary word overlap
    const existingWords = new Set(
      existing.summary
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    let wordIntersection = 0;
    for (const w of newWords) {
      if (existingWords.has(w)) wordIntersection++;
    }

    const hasTagOverlap = commonTags.length > 0;
    const hasWordOverlap = wordIntersection >= 2 || (newWords.size > 0 && wordIntersection / newWords.size >= 0.4);
    const sameSlug = slugify(newDecision.summary) === slugify(existing.summary);

    if (hasTagOverlap || hasWordOverlap || sameSlug) {
      const reasons: string[] = [];
      if (overlappingPatterns.length > 0) {
        reasons.push(`Overlapping file scope (${overlappingPatterns.join(', ')})`);
      }
      if (hasTagOverlap) {
        reasons.push(`Shared tags: ${commonTags.join(', ')}`);
      }
      if (hasWordOverlap || sameSlug) {
        reasons.push(`Similar architectural focus in summary`);
      }

      warnings.push({
        existingId: existing.id,
        existingSummary: existing.summary,
        existingScope: existing.scope,
        overlappingScopePatterns: overlappingPatterns,
        overlappingTags: commonTags,
        reason: reasons.join('; ')
      });
    }
  }

  return warnings;
}
