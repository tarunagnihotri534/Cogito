import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { minimatch } from 'minimatch';
import { loadIndex, normalizePath } from './store.js';

export interface DoctorIssue {
  type: 'dead_glob' | 'expired_review' | 'broken_superseded_by' | 'heavy_churn' | 'missing_scope';
  severity: 'error' | 'warning';
  decisionId: string;
  summary: string;
  message: string;
  details?: any;
}

export interface DoctorReport {
  healthy: boolean;
  totalActiveDecisions: number;
  issues: DoctorIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}

export function collectRepoFiles(dir: string, baseDir: string = dir): string[] {
  const ignoreDirs = new Set([
    'node_modules',
    '.git',
    '.decisions',
    'dist',
    'coverage',
    '.cursor',
    '.vscode',
    '.husky'
  ]);
  const files: string[] = [];

  function walk(current: string) {
    if (!fs.existsSync(current)) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            walk(path.join(current, entry.name));
          }
        } else if (entry.isFile()) {
          const rel = normalizePath(path.relative(baseDir, path.join(current, entry.name)));
          files.push(rel);
        }
      }
    } catch {}
  }

  walk(dir);
  return files;
}

export interface RunDoctorOptions {
  baseDir?: string;
  strict?: boolean;
  churnThreshold?: number;
  skipGit?: boolean;
}

export function runDoctor(options: RunDoctorOptions = {}): DoctorReport {
  const baseDir = options.baseDir || process.cwd();
  const allDecisions = loadIndex(baseDir);
  const activeDecisions = allDecisions.filter((d) => d.status === 'active');
  const repoFiles = collectRepoFiles(baseDir);

  const issues: DoctorIssue[] = [];
  const allIds = new Set(allDecisions.map((d) => d.id));
  const isGitRepo = !options.skipGit && fs.existsSync(path.join(baseDir, '.git'));
  const churnThreshold = options.churnThreshold ?? 10;
  const now = Date.now();

  // 1. Check every active decision for dead globs, expired review, missing scope, git churn
  for (const dec of activeDecisions) {
    // Missing scope
    if (!dec.scope || dec.scope.length === 0) {
      issues.push({
        type: 'missing_scope',
        severity: 'warning',
        decisionId: dec.id,
        summary: dec.summary,
        message: `Decision has no file scope defined (tagged 'needs-scope' or empty).`
      });
    } else {
      // Dead globs
      for (const pattern of dec.scope) {
        const normalizedPattern = normalizePath(pattern);
        const hasMatch = repoFiles.some((f) =>
          minimatch(f, normalizedPattern, { dot: true, matchBase: true })
        );

        if (!hasMatch) {
          issues.push({
            type: 'dead_glob',
            severity: 'warning',
            decisionId: dec.id,
            summary: dec.summary,
            message: `Glob pattern '${pattern}' matches 0 files in repository.`,
            details: { pattern }
          });
        }
      }
    }

    // Expired reviewBy
    if (dec.reviewBy) {
      const reviewTimestamp = new Date(dec.reviewBy).getTime();
      if (isNaN(reviewTimestamp)) {
        issues.push({
          type: 'expired_review',
          severity: 'error',
          decisionId: dec.id,
          summary: dec.summary,
          message: `Invalid reviewBy date format: '${dec.reviewBy}' (expected ISO YYYY-MM-DD).`,
          details: { reviewBy: dec.reviewBy }
        });
      } else if (reviewTimestamp < now) {
        const daysPast = Math.floor((now - reviewTimestamp) / (1000 * 60 * 60 * 24));
        issues.push({
          type: 'expired_review',
          severity: 'warning',
          decisionId: dec.id,
          summary: dec.summary,
          message: `Decision review date '${dec.reviewBy}' expired ${daysPast} day(s) ago.`,
          details: { reviewBy: dec.reviewBy, daysPast }
        });
      }
    }

    // Git churn check
    if (isGitRepo && dec.scope && dec.scope.length > 0) {
      try {
        const dateStr = dec.created ? dec.created.slice(0, 10) : '';
        const patternsToQuery = dec.scope.filter((p) => !p.includes('**/*')).slice(0, 5);
        if (patternsToQuery.length > 0 && dateStr) {
          const args = patternsToQuery.map((p) => `"${p}"`).join(' ');
          const gitCmd = `git log --oneline --since="${dateStr}" -- ${args}`;
          const output = execSync(gitCmd, {
            cwd: baseDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
          }).trim();

          const commitCount = output ? output.split('\n').length : 0;
          if (commitCount >= churnThreshold) {
            issues.push({
              type: 'heavy_churn',
              severity: 'warning',
              decisionId: dec.id,
              summary: dec.summary,
              message: `Scoped files have ${commitCount} commits since decision was recorded (${dateStr}). Consider reviewing if architectural assumptions still hold.`,
              details: { commitCount, churnThreshold }
            });
          }
        }
      } catch {}
    }
  }

  // 2. Check broken supersededBy links across all decisions
  for (const dec of allDecisions) {
    if (dec.supersededBy) {
      if (!allIds.has(dec.supersededBy)) {
        issues.push({
          type: 'broken_superseded_by',
          severity: 'error',
          decisionId: dec.id,
          summary: dec.summary,
          message: `Decision references supersededBy target '${dec.supersededBy}', which does not exist in decisions index.`,
          details: { brokenTarget: dec.supersededBy }
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    healthy: errorCount === 0 && warningCount === 0,
    totalActiveDecisions: activeDecisions.length,
    issues,
    summary: {
      errors: errorCount,
      warnings: warningCount
    }
  };
}
