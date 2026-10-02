function cleanUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanUndefined(v)])
    );
  }
  return obj;
}

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { recordDecision, getDecisionsDir } from '../store.js';
import { atomicWriteFile } from '../exporters/markers.js';
import { DecisionRecord, DecisionSourceObj } from '../../types/decision.js';

export interface ProposedCandidate {
  id: string;
  summary: string;
  rationale: string;
  scope: string[];
  tags: string[];
  score: number;
  confidence: 'suggested';
  created: string;
  source: {
    type: 'transcript';
    transcriptPath: string;
    sessionId?: string;
    hash?: string;
  };
  context?: string;
  consequences?: string;
}

export function getInboxDir(baseDir: string = process.cwd()): string {
  return path.join(getDecisionsDir(baseDir), '.inbox');
}

export function ensureInboxIgnored(baseDir: string = process.cwd()): boolean {
  const gitignorePath = path.join(baseDir, '.gitignore');
  const ignorePattern = '.decisions/.inbox/';

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (content.includes('.decisions/.inbox') || content.includes('.inbox/')) {
      return false;
    }
    const isCrlf = content.includes('\r\n');
    const eol = isCrlf ? '\r\n' : '\n';
    const updated = content.trimEnd() + eol + eol + '# cogito inbox' + eol + ignorePattern + eol;
    fs.writeFileSync(gitignorePath, updated, 'utf8');
    return true;
  } else {
    fs.writeFileSync(gitignorePath, '# cogito inbox\n' + ignorePattern + '\n', 'utf8');
    return true;
  }
}

export function saveInboxCandidate(
  baseDir: string = process.cwd(),
  candidate: ProposedCandidate
): string {
  const inboxDir = getInboxDir(baseDir);
  if (!fs.existsSync(inboxDir)) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }
  ensureInboxIgnored(baseDir);

  const filePath = path.join(inboxDir, `${candidate.id}.md`);
  const frontmatter = {
    id: candidate.id,
    summary: candidate.summary,
    rationale: candidate.rationale,
    scope: candidate.scope,
    tags: candidate.tags,
    score: candidate.score,
    confidence: candidate.confidence,
    created: candidate.created,
    source: candidate.source
  };

  const bodyParts = [
    `# Proposed: ${candidate.summary}`,
    '',
    '## Rationale',
    candidate.rationale
  ];

  if (candidate.context) {
    bodyParts.push('', '## Inferred Context', candidate.context);
  }
  if (candidate.consequences) {
    bodyParts.push('', '## Consequences', candidate.consequences);
  }

  const fileContent = matter.stringify(bodyParts.join('\n') + '\n', cleanUndefined(frontmatter));
  atomicWriteFile(filePath, fileContent);
  return filePath;
}

export function loadInboxCandidates(baseDir: string = process.cwd()): ProposedCandidate[] {
  const inboxDir = getInboxDir(baseDir);
  if (!fs.existsSync(inboxDir)) {
    return [];
  }

  const files = fs.readdirSync(inboxDir);
  const candidates: ProposedCandidate[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const fullPath = path.join(inboxDir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = matter(content);
      const data = parsed.data as any;

      if (data.id && data.summary) {
        candidates.push({
          id: data.id,
          summary: data.summary,
          rationale: data.rationale || '',
          scope: Array.isArray(data.scope) ? data.scope : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
          score: typeof data.score === 'number' ? data.score : 0.5,
          confidence: 'suggested',
          created: data.created || new Date().toISOString(),
          source: data.source || { type: 'transcript', transcriptPath: '' },
          context: data.context,
          consequences: data.consequences
        });
      }
    } catch {}
  }

  // Sort descending by score, then date
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.created).getTime() - new Date(a.created).getTime();
  });

  return candidates;
}

export function removeInboxCandidate(
  baseDir: string = process.cwd(),
  id: string
): boolean {
  const inboxDir = getInboxDir(baseDir);
  const filePath = path.join(inboxDir, `${id}.md`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function approveInboxCandidate(
  baseDir: string = process.cwd(),
  id: string,
  overrides?: Partial<ProposedCandidate>
): DecisionRecord | null {
  const candidates = loadInboxCandidates(baseDir);
  const candidate = candidates.find((c) => c.id === id);
  if (!candidate) {
    return null;
  }

  const merged = {
    ...candidate,
    ...overrides
  };

  const sourceObj: DecisionSourceObj = {
    type: 'transcript',
    path: merged.source?.transcriptPath || '',
    hash: merged.source?.hash || merged.id
  };

  const record = recordDecision(baseDir, {
    summary: merged.summary,
    rationale: merged.rationale,
    scope: merged.scope,
    tags: merged.tags,
    author: 'auto-capture',
    confidence: 'inferred',
    context: merged.context,
    consequences: merged.consequences,
    status: 'active',
    source: sourceObj
  });

  removeInboxCandidate(baseDir, id);
  return record;
}
