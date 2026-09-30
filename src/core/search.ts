import { loadIndex } from './store.js';
import { DecisionIndexItem, DecisionStatus } from '../types/decision.js';

export interface SearchResultItem {
  item: DecisionIndexItem;
  score: number;
  matchedFields: string[];
}

export function searchDecisions(
  baseDir: string = process.cwd(),
  query: string,
  filters?: { status?: DecisionStatus }
): SearchResultItem[] {
  let index = loadIndex(baseDir);

  if (filters?.status) {
    index = index.filter((d) => d.status === filters.status);
  }

  const terms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) {
    return [];
  }

  const results: SearchResultItem[] = [];

  for (const item of index) {
    let score = 0;
    const matchedFields: string[] = [];

    const summaryLower = item.summary.toLowerCase();
    const rationaleLower = (item.rationale || '').toLowerCase();
    const contextLower = (item.context || '').toLowerCase();
    const consequencesLower = (item.consequences || '').toLowerCase();
    const tagsLower = (item.tags || []).map((t) => t.toLowerCase());
    const authorLower = (item.author || '').toLowerCase();
    const scopeLower = (item.scope || []).map((s) => s.toLowerCase());

    for (const term of terms) {
      if (summaryLower.includes(term)) {
        score += 10;
        if (!matchedFields.includes('summary')) matchedFields.push('summary');
      }
      if (tagsLower.some((t) => t.includes(term))) {
        score += 8;
        if (!matchedFields.includes('tags')) matchedFields.push('tags');
      }
      if (rationaleLower.includes(term)) {
        score += 5;
        if (!matchedFields.includes('rationale')) matchedFields.push('rationale');
      }
      if (contextLower.includes(term)) {
        score += 3;
        if (!matchedFields.includes('context')) matchedFields.push('context');
      }
      if (consequencesLower.includes(term)) {
        score += 3;
        if (!matchedFields.includes('consequences')) matchedFields.push('consequences');
      }
      if (scopeLower.some((s) => s.includes(term))) {
        score += 2;
        if (!matchedFields.includes('scope')) matchedFields.push('scope');
      }
      if (authorLower.includes(term)) {
        score += 1;
        if (!matchedFields.includes('author')) matchedFields.push('author');
      }
    }

    if (score > 0) {
      results.push({
        item,
        score,
        matchedFields
      });
    }
  }

  // Sort descending by relevance score, then by creation date
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.item.created).getTime() - new Date(a.item.created).getTime();
  });

  return results;
}
