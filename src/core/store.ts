import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { minimatch } from 'minimatch';
import { customAlphabet } from 'nanoid';
import {
  DecisionFrontmatter,
  DecisionIndexItem,
  DecisionRecord,
  DecisionStatus,
  RecordDecisionInput,
  RecordDecisionSchema
} from '../types/decision.js';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

export function getDecisionsDir(baseDir: string = process.cwd()): string {
  return path.join(baseDir, '.decisions');
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'decision';
}

export function generateDecisionId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `dec_${dateStr}_${nanoid()}`;
}

export function initStorage(baseDir: string = process.cwd()): {
  decisionsDir: string;
  createdDirs: string[];
} {
  const decisionsDir = getDecisionsDir(baseDir);
  const activeDir = path.join(decisionsDir, 'active');
  const supersededDir = path.join(decisionsDir, 'superseded');
  const archivedDir = path.join(decisionsDir, 'archived');

  const createdDirs: string[] = [];

  for (const dir of [decisionsDir, activeDir, supersededDir, archivedDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      createdDirs.push(dir);
    }
  }

  const indexPath = path.join(decisionsDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify([], null, 2), 'utf-8');
  }

  reindexStorage(baseDir);

  return { decisionsDir, createdDirs };
}

export function reindexStorage(baseDir: string = process.cwd()): DecisionIndexItem[] {
  const decisionsDir = getDecisionsDir(baseDir);
  const statuses: DecisionStatus[] = ['active', 'superseded', 'archived'];
  const items: DecisionIndexItem[] = [];

  for (const status of statuses) {
    const statusDir = path.join(decisionsDir, status);
    if (!fs.existsSync(statusDir)) continue;

    const files = fs.readdirSync(statusDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const fullPath = path.join(statusDir, file);
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const parsed = matter(fileContent);
        const data = parsed.data as Partial<DecisionFrontmatter>;

        if (data.id && data.summary && data.scope) {
          const relativePath = normalizePath(path.relative(baseDir, fullPath));
          items.push({
            id: data.id,
            summary: data.summary,
            rationale: data.rationale || '',
            scope: Array.isArray(data.scope) ? data.scope : [data.scope],
            tags: Array.isArray(data.tags) ? data.tags : [],
            author: data.author || 'anonymous',
            status: (data.status as DecisionStatus) || status,
            confidence: data.confidence || 'explicit',
            created: data.created || new Date().toISOString(),
            filePath: relativePath,
            context: data.context,
            consequences: data.consequences,
            supersededBy: data.supersededBy
          });
        }
      } catch (err) {
        console.error(`Failed to parse decision file ${fullPath}:`, err);
      }
    }
  }

  // Sort items by creation date descending
  items.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  const indexPath = path.join(decisionsDir, 'index.json');
  if (fs.existsSync(decisionsDir)) {
    fs.writeFileSync(indexPath, JSON.stringify(items, null, 2), 'utf-8');
  }

  return items;
}

export function loadIndex(baseDir: string = process.cwd()): DecisionIndexItem[] {
  const indexPath = path.join(getDecisionsDir(baseDir), 'index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content) as DecisionIndexItem[];
    } catch {
      return reindexStorage(baseDir);
    }
  }
  return reindexStorage(baseDir);
}

export function recordDecision(
  baseDir: string = process.cwd(),
  rawInput: RecordDecisionInput & { id?: string; created?: string; source?: string }
): DecisionRecord {
  initStorage(baseDir);
  const input = RecordDecisionSchema.parse(rawInput);

  const id = rawInput.id || generateDecisionId();
  const created = rawInput.created || new Date().toISOString();
  const status: DecisionStatus = input.status || 'active';

  // Handle superseding existing decision if specified
  if (input.supersedes) {
    const existingIndex = loadIndex(baseDir);
    const targetOld = existingIndex.find((item) => item.id === input.supersedes);
    if (targetOld) {
      updateDecisionStatus(baseDir, targetOld.id, 'superseded', id);
    }
  }

  const frontmatter: DecisionFrontmatter = {
    id,
    summary: input.summary,
    rationale: input.rationale,
    scope: input.scope,
    tags: input.tags,
    author: input.author,
    status,
    confidence: input.confidence,
    created,
    context: input.context,
    consequences: input.consequences
  };

  const bodySections: string[] = [`# ${input.summary}\n`];
  bodySections.push(`## Rationale\n${input.rationale}\n`);
  if (input.context) {
    bodySections.push(`## Context\n${input.context}\n`);
  }
  if (input.consequences) {
    bodySections.push(`## Consequences\n${input.consequences}\n`);
  }

  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([_, v]) => v !== undefined)
  );

  const fileContent = matter.stringify(bodySections.join('\n'), cleanFrontmatter);

  // Generate slugified filename
  const baseSlug = slugify(input.summary);
  const targetDir = path.join(getDecisionsDir(baseDir), status);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let filename = `${baseSlug}.md`;
  let fullPath = path.join(targetDir, filename);

  // Handle collisions if file already exists with different ID
  if (fs.existsSync(fullPath)) {
    try {
      const existingData = matter(fs.readFileSync(fullPath, 'utf-8')).data;
      if (existingData.id && existingData.id !== id) {
        filename = `${baseSlug}-${id}.md`;
        fullPath = path.join(targetDir, filename);
      }
    } catch {}
  }

  fs.writeFileSync(fullPath, fileContent, 'utf-8');

  reindexStorage(baseDir);

  const relativePath = normalizePath(path.relative(baseDir, fullPath));

  return {
    ...frontmatter,
    filePath: relativePath,
    body: bodySections.join('\n')
  };
}

export function checkFileDecisions(
  baseDir: string = process.cwd(),
  filePath: string
): DecisionIndexItem[] {
  const index = loadIndex(baseDir);
  const activeDecisions = index.filter((item) => item.status === 'active');

  const normalizedInputPath = normalizePath(filePath);
  let relPath = normalizedInputPath;
  const normalizedBase = normalizePath(path.resolve(baseDir));
  if (normalizedInputPath.startsWith(normalizedBase)) {
    relPath = normalizedInputPath.slice(normalizedBase.length).replace(/^\//, '');
  }

  const matches = activeDecisions.filter((decision) => {
    return decision.scope.some((pattern) => {
      const normalizedPattern = normalizePath(pattern);
      return (
        minimatch(relPath, normalizedPattern, { dot: true, matchBase: true }) ||
        minimatch(normalizedInputPath, normalizedPattern, { dot: true })
      );
    });
  });

  return matches;
}

export function listDecisions(
  baseDir: string = process.cwd(),
  filters?: { status?: DecisionStatus; tags?: string[] }
): DecisionIndexItem[] {
  let index = loadIndex(baseDir);

  if (filters?.status) {
    index = index.filter((item) => item.status === filters.status);
  }

  if (filters?.tags && filters.tags.length > 0) {
    const filterTags = filters.tags.map((t) => t.toLowerCase());
    index = index.filter((item) =>
      item.tags.some((tag) => filterTags.includes(tag.toLowerCase()))
    );
  }

  return index;
}

export function getDecision(
  baseDir: string = process.cwd(),
  id: string
): DecisionRecord | null {
  const index = loadIndex(baseDir);
  const item = index.find((i) => i.id === id);
  if (!item) return null;

  const fullPath = path.resolve(baseDir, item.filePath);
  if (!fs.existsSync(fullPath)) return null;

  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  const parsed = matter(fileContent);

  return {
    ...(parsed.data as DecisionFrontmatter),
    filePath: item.filePath,
    body: parsed.content
  };
}

export function updateDecisionStatus(
  baseDir: string = process.cwd(),
  id: string,
  newStatus: DecisionStatus,
  supersededBy?: string
): DecisionRecord | null {
  const record = getDecision(baseDir, id);
  if (!record) return null;

  const oldPath = path.resolve(baseDir, record.filePath);
  const oldStatus = record.status;

  if (oldStatus === newStatus && !supersededBy) {
    return record;
  }

  const updatedFrontmatter: DecisionFrontmatter = {
    ...record,
    status: newStatus,
    supersededBy: supersededBy || record.supersededBy
  };

  delete (updatedFrontmatter as any).filePath;
  delete (updatedFrontmatter as any).body;

  const newDir = path.join(getDecisionsDir(baseDir), newStatus);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }

  const baseName = path.basename(oldPath);
  const newPath = path.join(newDir, baseName);

  const cleanFrontmatter = Object.fromEntries(
    Object.entries(updatedFrontmatter).filter(([_, v]) => v !== undefined)
  );

  const fileContent = matter.stringify(record.body, cleanFrontmatter);

  fs.writeFileSync(newPath, fileContent, 'utf-8');

  if (oldPath !== newPath && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }

  reindexStorage(baseDir);

  const relativePath = normalizePath(path.relative(baseDir, newPath));
  return {
    ...updatedFrontmatter,
    filePath: relativePath,
    body: record.body
  };
}

export class DecisionStore {
  constructor(public baseDir: string = process.cwd()) {}

  async init() {
    return initStorage(this.baseDir);
  }

  async create(input: any) {
    return recordDecision(this.baseDir, input);
  }

  async record(input: any) {
    return recordDecision(this.baseDir, input);
  }

  async check(filePath: string) {
    return checkFileDecisions(this.baseDir, filePath);
  }

  async list(filters?: any) {
    return listDecisions(this.baseDir, filters);
  }

  async get(id: string) {
    return getDecision(this.baseDir, id);
  }
}
