import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { DecisionStatus } from '../../types/decision.js';
import {
  loadIndex,
  recordDecision,
  updateDecisionStatus,
  normalizePath
} from '../store.js';

export interface ParsedAdr {
  filePath: string;
  relativePath: string;
  hash: string;
  idNumber?: string;
  slug: string;
  summary: string;
  status: DecisionStatus;
  rawStatus: string;
  supersededByRef?: string;
  supersedesRef?: string;
  rationale: string;
  context?: string;
  consequences?: string;
  scope: string[];
  tags: string[];
  author: string;
  created: string;
  needsScope: boolean;
}

export interface AdrImportItem {
  id: string;
  summary: string;
  filePath: string;
  adrPath: string;
  status: DecisionStatus;
  scope: string[];
  needsScope: boolean;
  supersededBy?: string;
}

export interface AdrSkippedItem {
  adrPath: string;
  reason: string;
  existingId?: string;
}

export interface AdrImportResult {
  imported: AdrImportItem[];
  skipped: AdrSkippedItem[];
  supersededCount: number;
  needsScopeCount: number;
  totalFound: number;
}

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function inferScopeFromContent(content: string, defaultScope?: string): { scope: string[]; needsScope: boolean } {
  const potentialPaths: Set<string> = new Set();

  // 1. Look for backtick-enclosed path-like strings: `src/...`, `lib/...`, etc.
  const backtickRegex = /`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickRegex.exec(content)) !== null) {
    const candidate = match[1].trim();
    if (isPathLike(candidate)) {
      potentialPaths.add(normalizeGlob(candidate));
    }
  }

  // 2. Look for standalone file/path mentions in text
  const pathRegex = /(?:^|\s)(src\/[a-zA-Z0-9_\-\.\/\*]+|lib\/[a-zA-Z0-9_\-\.\/\*]+|packages\/[a-zA-Z0-9_\-\.\/\*]+|app\/[a-zA-Z0-9_\-\.\/\*]+|\*\*\/\*[a-zA-Z0-9_\-\.]*|\*\.[a-zA-Z0-9]+)/g;
  while ((match = pathRegex.exec(content)) !== null) {
    const candidate = match[1].trim();
    if (isPathLike(candidate)) {
      potentialPaths.add(normalizeGlob(candidate));
    }
  }

  const result = Array.from(potentialPaths);

  if (result.length > 0) {
    return { scope: result, needsScope: false };
  }

  if (defaultScope && defaultScope.trim().length > 0) {
    return { scope: [defaultScope.trim()], needsScope: false };
  }

  return { scope: [], needsScope: true };
}

function isPathLike(str: string): boolean {
  if (!str || str.length < 2) return false;
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  if (str.endsWith('.md')) return false; // Usually ADR or doc links
  if (str.includes(' ') || str.includes('\n')) return false;
  if (str.startsWith('/') || str.startsWith('\\')) return false;

  const validPrefixes = ['src/', 'lib/', 'packages/', 'app/', 'components/', 'config/', 'api/', 'test/', 'tests/'];
  if (validPrefixes.some((p) => str.startsWith(p))) return true;
  if (str.startsWith('**') || str.startsWith('*.')) return true;
  if (str.includes('/') && /\.[a-zA-Z0-9]{1,5}$/.test(str)) return true;

  return false;
}

function normalizeGlob(p: string): string {
  let normalized = normalizePath(p).replace(/^[.\/]+/, '');
  if (normalized.endsWith('/')) {
    normalized = `${normalized}**/*`;
  }
  return normalized;
}

export function parseAdrContent(
  filePath: string,
  rawContent: string,
  defaultScope?: string
): ParsedAdr {
  const parsedMatter = matter(rawContent);
  const data = parsedMatter.data || {};
  const content = parsedMatter.content;
  const hash = computeSha256(rawContent);
  const baseName = path.basename(filePath, path.extname(filePath));

  // Extract ID number from filename if available (e.g. 0001-foo => 0001)
  const numMatch = baseName.match(/^(\d+)/);
  const idNumber = numMatch ? numMatch[1] : undefined;

  // 1. Summary / Title
  let summary = data.title ? String(data.title).trim() : '';
  if (!summary) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      summary = h1Match[1].trim();
      // Remove leading ADR prefixes like "ADR 001:", "1. ", "ADR-001 - "
      summary = summary.replace(/^(?:ADR[-_\s]*\d+[:\s-]*|\d+[\.\:\s-]+)/i, '').trim();
    } else {
      summary = baseName.replace(/^[-_\d]+/, '').replace(/[-_]+/g, ' ').trim();
    }
  }
  const safeSummary: string = summary || baseName;

  // 2. Status & Supersession extraction
  let rawStatus = data.status ? String(data.status).trim() : '';
  let supersededByRef: string | undefined = undefined;
  let supersedesRef: string | undefined = undefined;

  if (!rawStatus) {
    // Look for "* Status: ..." or "Status: ..." or "## Status\n\n..."
    const statusLineMatch = content.match(/(?:^|\n)(?:\*|-)?\s*(?:status|Status)\s*:\s*([^\n\r]+)/);
    if (statusLineMatch) {
      rawStatus = statusLineMatch[1].trim();
    } else {
      const statusSecMatch = content.match(/##\s+Status\s*\n+([^\n\r#]+)/i);
      if (statusSecMatch) {
        rawStatus = statusSecMatch[1].trim();
      }
    }
  }

  // Check for superseded references in raw status or content
  const supersededByMatch = rawStatus.match(/superseded\s+by\s+(.+)/i) ||
    content.match(/superseded\s+by\s+(?:\[([^\]]+)\](?:\([^)]+\))?|([a-zA-Z0-9_\-\.]+))/i);

  if (supersededByMatch) {
    supersededByRef = cleanReference(supersededByMatch[1] || supersededByMatch[2]);
  }

  const supersedesMatch = content.match(/supersedes\s+(?:\[([^\]]+)\](?:\([^)]+\))?|([a-zA-Z0-9_\-\.]+))/i);
  if (supersedesMatch) {
    supersedesRef = cleanReference(supersedesMatch[1] || supersedesMatch[2]);
  }

  let status: DecisionStatus = 'active';
  const lowerStatus = rawStatus.toLowerCase();
  if (supersededByRef || lowerStatus.includes('superseded')) {
    status = 'superseded';
  } else if (/deprecated|rejected|abandoned|archived|obsolete/.test(lowerStatus)) {
    status = 'archived';
  } else {
    status = 'active';
  }

  // 3. Date
  let created = data.date ? new Date(data.date).toISOString() : '';
  if (!created) {
    const dateMatch = content.match(/(?:^|\n)(?:\*|-)?\s*(?:date|Date)\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (dateMatch) {
      try {
        created = new Date(dateMatch[1]).toISOString();
      } catch {}
    }
  }
  if (!created) {
    try {
      const stat = fs.statSync(filePath);
      created = stat.birthtime && stat.birthtime.getTime() > 0
        ? stat.birthtime.toISOString()
        : stat.mtime.toISOString();
    } catch {
      created = new Date().toISOString();
    }
  }

  // 4. Author
  let author = data.author || data.deciders ? String(data.author || data.deciders).trim() : '';
  if (!author) {
    const authorMatch = content.match(/(?:^|\n)(?:\*|-)?\s*(?:deciders|authors|author)\s*:\s*([^\n\r]+)/i);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }
  }
  if (!author) {
    const byMatch = rawStatus.match(/\bby\s+([a-zA-Z0-9_\-]+)/i);
    if (byMatch) {
      author = byMatch[1].trim();
    }
  }
  const safeAuthor: string = author || 'adr-import';

  // 5. Sections: Context, Decision/Rationale, Consequences
  const context = extractSection(content, [
    'Context and Problem Statement',
    'Context',
    'Problem Statement'
  ]);

  let rationale = extractSection(content, [
    'Decision Outcome',
    'Decision',
    'Rationale',
    'Decision Drivers'
  ]);

  if (!rationale) {
    // If no explicit decision/rationale header, use considered options or summary
    const options = extractSection(content, ['Considered Options']);
    rationale = options ? `Considered options:\n${options}` : safeSummary;
  }
  const safeRationale: string = (rationale || safeSummary || 'No rationale specified in ADR').trim();

  const consequences = extractSection(content, [
    'Consequences',
    'Positive Consequences',
    'Negative Consequences'
  ]);

  // 6. Scope inference
  const { scope, needsScope } = inferScopeFromContent(content, defaultScope);

  // 7. Tags
  const tags: string[] = ['adr'];
  if (Array.isArray(data.tags)) {
    data.tags.forEach((t: string) => tags.push(String(t).trim()));
  }
  if (needsScope) {
    tags.push('needs-scope');
  }

  return {
    filePath,
    relativePath: normalizePath(filePath),
    hash,
    idNumber,
    slug: baseName,
    summary: safeSummary,
    status,
    rawStatus,
    supersededByRef,
    supersedesRef,
    rationale: safeRationale,
    context,
    consequences,
    scope,
    tags,
    author: safeAuthor,
    created,
    needsScope
  };
}

function cleanReference(ref: string): string {
  if (!ref) return '';
  return ref
    .replace(/^\[/, '')
    .replace(/\](?:\([^\)]+\))?$/, '')
    .replace(/\.md$/, '')
    .trim();
}

function extractSection(content: string, headerNames: string[]): string | undefined {
  for (const name of headerNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`##+\\s+${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n##+|$)`, 'i');
    const match = content.match(regex);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return undefined;
}

export async function importAdrs(
  baseDir: string = process.cwd(),
  options: {
    dir: string;
    defaultScope?: string;
    dryRun?: boolean;
  }
): Promise<AdrImportResult> {
  // Sanitize path with realpath
  const targetDir = path.resolve(baseDir, options.dir);
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target directory '${options.dir}' does not exist.`);
  }

  const realTargetDir = fs.realpathSync(targetDir);
  const files = fs.readdirSync(realTargetDir)
    .filter((f) => f.endsWith('.md') && !f.toLowerCase().startsWith('readme'))
    .sort();

  const existingIndex = loadIndex(baseDir);
  const imported: AdrImportItem[] = [];
  const skipped: AdrSkippedItem[] = [];

  // Map to resolve supersessions: ref identifier -> { id, parsed }
  const refMap = new Map<string, { id: string; parsed: ParsedAdr }>();

  // Pass 1: Parse and record or dry-run
  const parsedList: ParsedAdr[] = [];

  for (const file of files) {
    const fullPath = path.join(realTargetDir, file);
    const relativePath = normalizePath(path.relative(baseDir, fullPath));
    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const parsed = parseAdrContent(fullPath, rawContent, options.defaultScope);
    parsed.relativePath = relativePath;

    // Check for idempotency against existing index
    const existing = existingIndex.find((item) => {
      if (typeof item.source === 'object' && item.source !== null) {
        return item.source.type === 'adr' && item.source.path === relativePath;
      }
      return false;
    });

    if (existing && typeof existing.source === 'object' && existing.source !== null) {
      if (existing.source.hash === parsed.hash) {
        skipped.push({
          adrPath: relativePath,
          reason: 'Identical content already imported',
          existingId: existing.id
        });
        registerRef(refMap, existing.id, parsed);
        continue;
      }
    }

    parsedList.push(parsed);

    if (options.dryRun) {
      const mockId = `dec_dryrun_${parsed.idNumber || parsed.slug}`;
      imported.push({
        id: mockId,
        summary: parsed.summary,
        filePath: `.decisions/${parsed.status}/${parsed.slug}.md`,
        adrPath: relativePath,
        status: parsed.status,
        scope: parsed.scope,
        needsScope: parsed.needsScope
      });
      registerRef(refMap, mockId, parsed);
    } else {
      const record = recordDecision(baseDir, {
        summary: parsed.summary,
        rationale: parsed.rationale,
        scope: parsed.scope,
        tags: parsed.tags,
        author: parsed.author,
        status: parsed.status,
        confidence: 'explicit',
        created: parsed.created,
        context: parsed.context,
        consequences: parsed.consequences,
        source: {
          type: 'adr',
          path: relativePath,
          hash: parsed.hash
        }
      });

      imported.push({
        id: record.id,
        summary: record.summary,
        filePath: record.filePath,
        adrPath: relativePath,
        status: record.status,
        scope: record.scope,
        needsScope: parsed.needsScope
      });
      registerRef(refMap, record.id, parsed);
    }
  }

  // Pass 2: Resolve supersession links
  let supersededCount = 0;

  for (const parsed of parsedList) {
    const currentItem = imported.find((i) => i.adrPath === parsed.relativePath);
    if (!currentItem) continue;

    // Check if this decision is superseded by another ADR
    if (parsed.supersededByRef) {
      const target = lookupRef(refMap, parsed.supersededByRef);
      if (target && target.id !== currentItem.id) {
        currentItem.supersededBy = target.id;
        currentItem.status = 'superseded';
        supersededCount++;

        if (!options.dryRun) {
          updateDecisionStatus(baseDir, currentItem.id, 'superseded', target.id);
        }
      }
    }

    // Check if this decision explicitly supersedes an older ADR
    if (parsed.supersedesRef) {
      const targetOld = lookupRef(refMap, parsed.supersedesRef);
      if (targetOld && targetOld.id !== currentItem.id) {
        const oldImported = imported.find((i) => i.id === targetOld.id);
        if (oldImported) {
          oldImported.supersededBy = currentItem.id;
          oldImported.status = 'superseded';
        }
        supersededCount++;

        if (!options.dryRun) {
          updateDecisionStatus(baseDir, targetOld.id, 'superseded', currentItem.id);
        }
      }
    }
  }

  const needsScopeCount = imported.filter((i) => i.needsScope).length;

  return {
    imported,
    skipped,
    supersededCount,
    needsScopeCount,
    totalFound: files.length
  };
}

function registerRef(
  map: Map<string, { id: string; parsed: ParsedAdr }>,
  id: string,
  parsed: ParsedAdr
) {
  const entry = { id, parsed };
  map.set(parsed.slug.toLowerCase(), entry);
  if (parsed.idNumber) {
    map.set(parsed.idNumber, entry);
    map.set(String(parseInt(parsed.idNumber, 10)), entry);
    map.set(`adr-${parsed.idNumber}`.toLowerCase(), entry);
    map.set(`adr-${parseInt(parsed.idNumber, 10)}`.toLowerCase(), entry);
  }
  map.set(parsed.summary.toLowerCase(), entry);
}

function lookupRef(
  map: Map<string, { id: string; parsed: ParsedAdr }>,
  ref: string
): { id: string; parsed: ParsedAdr } | undefined {
  const clean = ref.trim().toLowerCase();
  if (map.has(clean)) return map.get(clean);

  // Try extracting number
  const numMatch = clean.match(/(\d+)/);
  if (numMatch) {
    if (map.has(numMatch[1])) return map.get(numMatch[1]);
    const numInt = String(parseInt(numMatch[1], 10));
    if (map.has(numInt)) return map.get(numInt);
  }

  // Prefix checks
  for (const [key, value] of map.entries()) {
    if (key.includes(clean) || clean.includes(key)) {
      return value;
    }
  }

  return undefined;
}
