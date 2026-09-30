import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import { DecisionIndexItem } from '../../types/decision.js';
import { slugify } from '../store.js';
import { ProposedCandidate } from './inbox.js';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

export interface ParsedTranscript {
  messages: Array<{ role: string; content: string }>;
  editedFiles: string[];
}

export function parseTranscript(transcriptPath: string): ParsedTranscript {
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file '${transcriptPath}' not found`);
  }

  const fileContent = fs.readFileSync(transcriptPath, 'utf8');
  const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const messages: Array<{ role: string; content: string }> = [];
  const editedFilesSet = new Set<string>();

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);

      // Handle tool calls
      if (obj.type === 'tool_use' || obj.tool_name || obj.name) {
        const input = obj.input || obj.tool_input || obj.parameters || {};
        const fp = input.file_path || input.path || input.TargetFile || input.filePath;
        if (typeof fp === 'string' && fp.trim().length > 0) {
          editedFilesSet.add(fp.trim().replace(/\\/g, '/'));
        }
      }

      if (Array.isArray(obj.tool_calls)) {
        for (const tc of obj.tool_calls) {
          const args = tc.args || tc.parameters || tc.input || {};
          const fp = args.file_path || args.path || args.TargetFile || args.filePath;
          if (typeof fp === 'string' && fp.trim().length > 0) {
            editedFilesSet.add(fp.trim().replace(/\\/g, '/'));
          }
        }
      }

      // Handle text messages
      let textContent = '';
      if (typeof obj.content === 'string') {
        textContent = obj.content;
      } else if (Array.isArray(obj.content)) {
        textContent = obj.content
          .filter((c: any) => c && (c.type === 'text' || typeof c === 'string'))
          .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
          .join('\n');
      } else if (obj.message && typeof obj.message.content === 'string') {
        textContent = obj.message.content;
      } else if (obj.message && Array.isArray(obj.message.content)) {
        textContent = obj.message.content
          .map((c: any) => (typeof c === 'string' ? c : c.text || ''))
          .join('\n');
      }

      const role =
        obj.role ||
        (obj.type === 'USER_INPUT' ? 'user' : obj.type === 'PLANNER_RESPONSE' ? 'assistant' : 'assistant');

      if (textContent.trim().length > 0) {
        messages.push({ role, content: textContent });
      }
    } catch {}
  }

  return {
    messages,
    editedFiles: Array.from(editedFilesSet)
  };
}

export function scoreCandidate(
  summary: string,
  rationale: string,
  scope: string[],
  context?: string
): number {
  let score = 0.3; // baseline

  const lowerSum = summary.toLowerCase();
  const lowerRat = rationale.toLowerCase();
  const combined = `${lowerSum} ${lowerRat} ${context?.toLowerCase() || ''}`;

  // Decision verbs (+0.25)
  if (/\b(decided|chose|opted|adopted|selected|standardized|enforce|agreed|mandated)\b/.test(combined)) {
    score += 0.25;
  } else if (/\b(use|using|switch|prefer|migrate|implement)\b/.test(combined)) {
    score += 0.15;
  }

  // Rationale depth (+0.25)
  if (
    /\b(because|due to|in order to|trade-off|tradeoff|reason|downside|to prevent|to ensure|security|compliance|performance|latency|resilience)\b/.test(
      combined
    )
  ) {
    score += 0.25;
  } else if (rationale.length > 50) {
    score += 0.1;
  }

  // Comparative reasoning (+0.1)
  if (/\b(instead of|rather than|over|against|alternative|compared to)\b/.test(combined)) {
    score += 0.1;
  }

  // File scope (+0.1)
  if (scope.length > 0) {
    score += 0.1;
  }

  // Minimum length check
  if (rationale.length < 20) {
    score -= 0.15;
  }

  return Math.min(1.0, Math.max(0.1, Math.round(score * 100) / 100));
}

export function isDuplicateDecision(
  candidate: { summary: string; scope: string[] },
  existingDecisions: DecisionIndexItem[]
): boolean {
  const candSlug = slugify(candidate.summary);
  const candWords = new Set(
    candidate.summary
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  for (const existing of existingDecisions) {
    if (existing.status !== 'active') continue;
    const existSlug = slugify(existing.summary);
    if (candSlug === existSlug) return true;

    const existWords = new Set(
      existing.summary
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    if (candWords.size > 0 && existWords.size > 0) {
      let intersection = 0;
      for (const w of candWords) {
        if (existWords.has(w)) intersection++;
      }
      const overlapRatio = intersection / Math.min(candWords.size, existWords.size);
      if (overlapRatio >= 0.75) return true;
    }
  }
  return false;
}

export function extractCandidates(
  transcript: ParsedTranscript,
  existingDecisions: DecisionIndexItem[],
  transcriptPath: string,
  sessionId?: string
): ProposedCandidate[] {
  const candidates: ProposedCandidate[] = [];
  const assistantTexts = transcript.messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content);

  const decisionRegexes = [
    /(?:(?:we\s+)?(?:decided|chose|opted)\s+to\s+|decision:\s*)([^\n.]+?)\s+(?:because|in order to|due to|since|as)\s+([^\n]+)/gi,
    /(?:decision|architectural\s+decision):\s*([^\n.]+?)\.?\s+(?:rationale:\s*)([^\n]+)/gi,
    /(?:architecture|architectural\s+decision):\s*([^\n]+?)\s+(?:because|rationale:\s*)([^\n]+)/gi
  ];

  for (const text of assistantTexts) {
    for (const regex of decisionRegexes) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        let summary = match[1].trim();
        let rationale = match[2].trim();

        summary = summary.replace(/^[-*#\s]+/, '').replace(/[:.]+$/, '').trim();
        if (summary.length > 0) {
          summary = summary[0].toUpperCase() + summary.slice(1);
        }

        if (summary.length < 5 || rationale.length < 10) continue;

        let scope: string[] = [];
        if (transcript.editedFiles.length > 0) {
          const lowerSummary = summary.toLowerCase();
          const matchedFiles = transcript.editedFiles.filter((f) => {
            const parts = f.toLowerCase().split('/');
            return parts.some((p) => lowerSummary.includes(p.replace(/\.[^.]+$/, '')));
          });

          if (matchedFiles.length > 0) {
            scope = matchedFiles;
          } else {
            const dirs = Array.from(
              new Set(transcript.editedFiles.map((f) => path.dirname(f).replace(/\\/g, '/')))
            ).filter((d) => d !== '.');

            if (dirs.length === 1) {
              scope = [`${dirs[0]}/**/*`];
            } else if (dirs.length > 1 && dirs.length <= 3) {
              scope = dirs.map((d) => `${d}/**/*`);
            } else if (transcript.editedFiles.length <= 5) {
              scope = transcript.editedFiles;
            }
          }
        }

        const tags: string[] = [];
        const combined = (summary + ' ' + rationale).toLowerCase();
        for (const kw of ['auth', 'database', 'api', 'security', 'cache', 'testing', 'ui', 'cli', 'performance']) {
          if (combined.includes(kw)) tags.push(kw);
        }

        const score = scoreCandidate(summary, rationale, scope, text.slice(0, 300));

        if (isDuplicateDecision({ summary, scope }, existingDecisions)) {
          continue;
        }

        const isInternalDup = candidates.some(
          (c) => slugify(c.summary) === slugify(summary)
        );
        if (isInternalDup) continue;

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const id = `prop_${dateStr}_${nanoid()}`;
        const contentHash = crypto
          .createHash('sha256')
          .update(summary + rationale + scope.join(','))
          .digest('hex')
          .slice(0, 12);

        candidates.push({
          id,
          summary,
          rationale,
          scope,
          tags,
          score,
          confidence: 'suggested',
          created: new Date().toISOString(),
          source: {
            type: 'transcript',
            transcriptPath,
            sessionId,
            hash: contentHash
          },
          context: text.length > 500 ? text.slice(0, 500) + '...' : text
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 5);
}
