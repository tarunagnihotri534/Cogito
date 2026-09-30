import fs from 'fs';
import path from 'path';
import { loadIndex } from './store.js';
import { DecisionIndexItem } from '../types/decision.js';

export interface SemanticMatchResult {
  decision: DecisionIndexItem;
  score: number;
  reasons: string[];
  matchedImports: string[];
  matchedKeywords: string[];
}

export interface SemanticMatcherPlugin {
  name: string;
  match(
    filePath: string,
    fileContent: string,
    decision: DecisionIndexItem
  ): SemanticMatchResult | null;
}

export function extractImports(fileContent: string): string[] {
  const imports: string[] = [];
  // ES import: import ... from 'pkg'
  const esImportRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"])|(?:import\s*\(['"]([^'"]+)['"]\))/g;
  let match: RegExpExecArray | null;
  while ((match = esImportRegex.exec(fileContent)) !== null) {
    const pkg = match[1] || match[2];
    if (pkg) imports.push(pkg);
  }

  // CommonJS require: require('pkg')
  const cjsRegex = /require\(['"]([^'"]+)['"]\)/g;
  while ((match = cjsRegex.exec(fileContent)) !== null) {
    if (match[1]) imports.push(match[1]);
  }

  return Array.from(new Set(imports));
}

export class LocalKeywordSemanticMatcher implements SemanticMatcherPlugin {
  name = 'local-keyword-import-matcher';

  match(
    filePath: string,
    fileContent: string,
    decision: DecisionIndexItem
  ): SemanticMatchResult | null {
    const reasons: string[] = [];
    const matchedImports: string[] = [];
    const matchedKeywords: string[] = [];
    let score = 0;

    const imports = extractImports(fileContent);
    const contentLower = fileContent.toLowerCase();

    // 1. Tag & keyword matching against imports
    const tags = (decision.tags || []).map((t) => t.toLowerCase());
    for (const imp of imports) {
      const impBase = imp.split('/')[0].replace(/^@/, '');
      for (const tag of tags) {
        if (impBase.includes(tag) || tag.includes(impBase)) {
          score += 0.45;
          matchedImports.push(imp);
          reasons.push(`File imports "${imp}" matching decision tag "${tag}"`);
        }
      }
    }

    // 2. Summary keyword matching in content
    const summaryWords = decision.summary
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4);

    let keywordHits = 0;
    for (const word of summaryWords) {
      if (contentLower.includes(word)) {
        keywordHits++;
        matchedKeywords.push(word);
      }
    }

    if (keywordHits >= 2) {
      score += 0.35;
      reasons.push(`File contains key architectural terms: ${matchedKeywords.slice(0, 3).join(', ')}`);
    } else if (keywordHits === 1) {
      score += 0.15;
    }

    // 3. Specific technology tag checks
    for (const tag of tags) {
      if (tag.length > 3 && contentLower.includes(tag)) {
        score += 0.2;
        reasons.push(`File mentions decision tag "${tag}"`);
        break;
      }
    }

    score = Math.min(1.0, Math.round(score * 100) / 100);

    if (score >= 0.4) {
      return {
        decision,
        score,
        reasons: Array.from(new Set(reasons)),
        matchedImports,
        matchedKeywords
      };
    }

    return null;
  }
}

export function matchFileSemantically(
  baseDir: string = process.cwd(),
  filePath: string,
  options?: { minScore?: number; customPlugin?: SemanticMatcherPlugin }
): SemanticMatchResult[] {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const fileContent = fs.readFileSync(fullPath, 'utf8');
  const index = loadIndex(baseDir);
  const activeDecisions = index.filter((d) => d.status === 'active');
  const matcher = options?.customPlugin || new LocalKeywordSemanticMatcher();
  const minScore = options?.minScore ?? 0.4;

  const results: SemanticMatchResult[] = [];

  for (const dec of activeDecisions) {
    const res = matcher.match(filePath, fileContent, dec);
    if (res && res.score >= minScore) {
      results.push(res);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
