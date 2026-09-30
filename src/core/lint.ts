import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getDecisionsDir, normalizePath } from './store.js';
import { DecisionStatus } from '../types/decision.js';

export interface LintError {
  filePath: string;
  decisionId?: string;
  field?: string;
  message: string;
}

export interface LintResult {
  valid: boolean;
  totalFiles: number;
  errors: LintError[];
}

export function lintDecisions(baseDir: string = process.cwd()): LintResult {
  const decisionsDir = getDecisionsDir(baseDir);
  const statuses: DecisionStatus[] = ['active', 'superseded', 'archived'];
  const errors: LintError[] = [];
  const seenIds = new Map<string, string>(); // id -> filePath
  let totalFiles = 0;

  for (const status of statuses) {
    const statusDir = path.join(decisionsDir, status);
    if (!fs.existsSync(statusDir)) continue;

    const files = fs.readdirSync(statusDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      totalFiles++;
      const fullPath = path.join(statusDir, file);
      const relPath = normalizePath(path.relative(baseDir, fullPath));

      try {
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        const parsed = matter(rawContent);
        const data = parsed.data;

        if (!data || typeof data !== 'object') {
          errors.push({
            filePath: relPath,
            message: 'File is missing YAML frontmatter block.'
          });
          continue;
        }

        // Required fields
        if (!data.id || typeof data.id !== 'string') {
          errors.push({
            filePath: relPath,
            field: 'id',
            message: 'Missing or non-string required field "id".'
          });
        } else {
          // Duplicate ID check
          if (seenIds.has(data.id)) {
            errors.push({
              filePath: relPath,
              decisionId: data.id,
              field: 'id',
              message: `Duplicate decision ID "${data.id}" already declared in ${seenIds.get(data.id)}.`
            });
          } else {
            seenIds.set(data.id, relPath);
          }
        }

        if (!data.summary || typeof data.summary !== 'string') {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'summary',
            message: 'Missing or non-string required field "summary".'
          });
        }

        if (!data.rationale || typeof data.rationale !== 'string') {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'rationale',
            message: 'Missing or non-string required field "rationale".'
          });
        }

        // Status check against folder
        if (!data.status) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'status',
            message: `Missing required field "status" (expected "${status}").`
          });
        } else if (data.status !== status) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'status',
            message: `Status "${data.status}" does not match parent directory "${status}".`
          });
        }

        // Created date
        if (!data.created) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'created',
            message: 'Missing required field "created".'
          });
        } else if (isNaN(new Date(data.created).getTime())) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'created',
            message: `Invalid date format in "created": "${data.created}".`
          });
        }

        // reviewBy date if present
        if (data.reviewBy && isNaN(new Date(data.reviewBy).getTime())) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'reviewBy',
            message: `Invalid date format in "reviewBy": "${data.reviewBy}".`
          });
        }

        // Scope check
        if (data.scope !== undefined && !Array.isArray(data.scope)) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'scope',
            message: 'Field "scope" must be an array of glob strings.'
          });
        }

        // Tags check
        if (data.tags !== undefined && !Array.isArray(data.tags)) {
          errors.push({
            filePath: relPath,
            decisionId: data.id,
            field: 'tags',
            message: 'Field "tags" must be an array of strings.'
          });
        }
      } catch (err: any) {
        errors.push({
          filePath: relPath,
          message: `Failed to parse markdown file: ${err.message}`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    totalFiles,
    errors
  };
}
