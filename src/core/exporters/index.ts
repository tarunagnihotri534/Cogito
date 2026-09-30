import fs from 'fs';
import path from 'path';
import { loadIndex, reindexStorage } from '../store.js';
import { formatDecisionsMarkdown, FormatOptions } from './markdown.js';
import { exportCursorRules, checkCursorRules, CursorExportResult, CursorCheckResult } from './cursor.js';
import { injectManagedSection, atomicWriteFile } from './markers.js';
import { installPreCommitHook, PreCommitHookResult } from './git.js';

export type ExportTarget = 'cursor' | 'agents-md' | 'copilot' | 'windsurf' | 'all';

export interface TargetExportStatus {
  target: string;
  files: string[];
  changed: boolean;
  message?: string;
}

export interface ExportResult {
  success: boolean;
  targets: TargetExportStatus[];
}

export interface CheckTargetStatus {
  target: string;
  inSync: boolean;
  details: string[];
}

export interface CheckExportResult {
  inSync: boolean;
  targets: CheckTargetStatus[];
}

export function resolveTargetFilePath(baseDir: string, target: 'agents-md' | 'copilot' | 'windsurf'): string {
  switch (target) {
    case 'agents-md':
      return path.join(baseDir, 'AGENTS.md');
    case 'copilot':
      return path.join(baseDir, '.github', 'copilot-instructions.md');
    case 'windsurf': {
      const windsurfDir = path.join(baseDir, '.windsurf');
      if (fs.existsSync(windsurfDir)) {
        return path.join(windsurfDir, 'rules', 'decisions.md');
      }
      return path.join(baseDir, '.windsurfrules');
    }
  }
}

export function exportDecisions(options: {
  baseDir?: string;
  target?: ExportTarget;
  maxDecisions?: number;
  maxRationaleLen?: number;
}): ExportResult {
  const baseDir = options.baseDir || process.cwd();
  const target = options.target || 'all';
  const decisions = loadIndex(baseDir);

  const targetsToExport: ('cursor' | 'agents-md' | 'copilot' | 'windsurf')[] =
    target === 'all'
      ? ['cursor', 'agents-md', 'copilot', 'windsurf']
      : [target as any];

  const results: TargetExportStatus[] = [];

  for (const t of targetsToExport) {
    if (t === 'cursor') {
      const cursorRes = exportCursorRules(baseDir, decisions);
      const changed =
        cursorRes.created.length > 0 ||
        cursorRes.updated.length > 0 ||
        cursorRes.deleted.length > 0;
      const allFiles = [
        ...cursorRes.created,
        ...cursorRes.updated,
        ...cursorRes.deleted.map((f) => `${f} (deleted)`),
        ...cursorRes.unchanged
      ];
      results.push({
        target: 'cursor',
        files: allFiles,
        changed,
        message: `${cursorRes.created.length} created, ${cursorRes.updated.length} updated, ${cursorRes.deleted.length} deleted, ${cursorRes.unchanged.length} unchanged`
      });
    } else {
      const targetFilePath = resolveTargetFilePath(baseDir, t);
      const relPath = path.relative(baseDir, targetFilePath).replace(/\\/g, '/');
      const managedMarkdown = formatDecisionsMarkdown(decisions, {
        maxDecisions: options.maxDecisions,
        maxRationaleLen: options.maxRationaleLen
      });

      const existingContent = fs.existsSync(targetFilePath)
        ? fs.readFileSync(targetFilePath, 'utf8')
        : '';

      const injected = injectManagedSection(existingContent, managedMarkdown, relPath);
      if (injected.changed || !fs.existsSync(targetFilePath)) {
        atomicWriteFile(targetFilePath, injected.content);
        results.push({
          target: t,
          files: [relPath],
          changed: true,
          message: fs.existsSync(targetFilePath) ? 'Updated managed section' : 'Created file with managed section'
        });
      } else {
        results.push({
          target: t,
          files: [relPath],
          changed: false,
          message: 'Up to date'
        });
      }
    }
  }

  return {
    success: true,
    targets: results
  };
}

export function checkExport(options: {
  baseDir?: string;
  target?: ExportTarget;
  maxDecisions?: number;
  maxRationaleLen?: number;
}): CheckExportResult {
  const baseDir = options.baseDir || process.cwd();
  const target = options.target || 'all';
  const decisions = loadIndex(baseDir);

  const targetsToCheck: ('cursor' | 'agents-md' | 'copilot' | 'windsurf')[] =
    target === 'all'
      ? ['cursor', 'agents-md', 'copilot', 'windsurf']
      : [target as any];

  const results: CheckTargetStatus[] = [];
  let allInSync = true;

  for (const t of targetsToCheck) {
    if (t === 'cursor') {
      const cursorRes = checkCursorRules(baseDir, decisions);
      const details: string[] = [];
      if (cursorRes.missingFiles.length > 0) {
        details.push(`Missing: ${cursorRes.missingFiles.join(', ')}`);
      }
      if (cursorRes.outOfSyncFiles.length > 0) {
        details.push(`Out of sync: ${cursorRes.outOfSyncFiles.join(', ')}`);
      }
      if (cursorRes.staleFiles.length > 0) {
        details.push(`Stale rules to remove: ${cursorRes.staleFiles.join(', ')}`);
      }
      if (!cursorRes.inSync) {
        allInSync = false;
      }
      results.push({
        target: 'cursor',
        inSync: cursorRes.inSync,
        details
      });
    } else {
      const targetFilePath = resolveTargetFilePath(baseDir, t);
      const relPath = path.relative(baseDir, targetFilePath).replace(/\\/g, '/');
      const managedMarkdown = formatDecisionsMarkdown(decisions, {
        maxDecisions: options.maxDecisions,
        maxRationaleLen: options.maxRationaleLen
      });

      const details: string[] = [];
      let inSync = true;

      if (!fs.existsSync(targetFilePath)) {
        inSync = false;
        details.push(`File ${relPath} does not exist`);
      } else {
        const existingContent = fs.readFileSync(targetFilePath, 'utf8');
        try {
          const injected = injectManagedSection(existingContent, managedMarkdown, relPath);
          if (injected.changed) {
            inSync = false;
            details.push(`Managed section in ${relPath} is out of date`);
          }
        } catch (err: any) {
          inSync = false;
          details.push(`Error in ${relPath}: ${err.message}`);
        }
      }

      if (!inSync) {
        allInSync = false;
      }

      results.push({
        target: t,
        inSync,
        details
      });
    }
  }

  return {
    inSync: allInSync,
    targets: results
  };
}

export function watchDecisions(options: {
  baseDir?: string;
  target?: ExportTarget;
  debounceMs?: number;
  onExport?: (result: ExportResult) => void;
  onError?: (err: Error) => void;
}): { close: () => void } {
  const baseDir = options.baseDir || process.cwd();
  const decisionsDir = path.join(baseDir, '.decisions');
  const debounceMs = options.debounceMs ?? 250;

  let debounceTimeout: NodeJS.Timeout | null = null;

  if (!fs.existsSync(decisionsDir)) {
    fs.mkdirSync(decisionsDir, { recursive: true });
  }

  const watcher = fs.watch(decisionsDir, { recursive: true }, (_eventType, filename) => {
    // Ignore internal temporary files or index.json changes triggered by reindex
    if (filename && (filename.startsWith('.') || filename === 'index.json')) {
      return;
    }

    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      try {
        reindexStorage(baseDir);
        const res = exportDecisions({
          baseDir,
          target: options.target
        });
        options.onExport?.(res);
      } catch (err: any) {
        options.onError?.(err);
      }
    }, debounceMs);
  });

  return {
    close: () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      watcher.close();
    }
  };
}

export {
  injectManagedSection,
  atomicWriteFile,
  BEGIN_MARKER,
  END_MARKER
} from './markers.js';

export {
  formatDecisionsMarkdown
} from './markdown.js';

export {
  exportCursorRules,
  checkCursorRules
} from './cursor.js';

export {
  installPreCommitHook
} from './git.js';
