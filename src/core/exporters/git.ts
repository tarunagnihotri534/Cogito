import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface PreCommitHookResult {
  path: string;
  hookType: 'husky' | 'core.hooksPath' | 'git';
  created: boolean;
  updated: boolean;
}

export function installPreCommitHook(baseDir: string = process.cwd()): PreCommitHookResult {
  const hookCommand = 'npx decision-tracker export --check';
  const huskyDir = path.join(baseDir, '.husky');

  let hookPath: string;
  let hookType: 'husky' | 'core.hooksPath' | 'git';

  // 1. Husky check
  if (fs.existsSync(huskyDir) && fs.statSync(huskyDir).isDirectory()) {
    hookPath = path.join(huskyDir, 'pre-commit');
    hookType = 'husky';
  } else {
    // 2. git config core.hooksPath
    let configuredHooksPath: string | null = null;
    try {
      const output = execSync('git config --get core.hooksPath', {
        cwd: baseDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      if (output) {
        configuredHooksPath = path.resolve(baseDir, output);
      }
    } catch {}

    if (configuredHooksPath) {
      if (!fs.existsSync(configuredHooksPath)) {
        fs.mkdirSync(configuredHooksPath, { recursive: true });
      }
      hookPath = path.join(configuredHooksPath, 'pre-commit');
      hookType = 'core.hooksPath';
    } else {
      // 3. Fallback to .git/hooks/pre-commit
      let gitDir = path.join(baseDir, '.git');
      if (fs.existsSync(gitDir) && fs.statSync(gitDir).isFile()) {
        // Handle git worktrees or submodules (gitdir: /path/...)
        try {
          const content = fs.readFileSync(gitDir, 'utf8').trim();
          const match = content.match(/^gitdir:\s*(.+)$/i);
          if (match) {
            gitDir = path.resolve(baseDir, match[1]);
          }
        } catch {}
      }

      const gitHooksDir = path.join(gitDir, 'hooks');
      if (!fs.existsSync(gitHooksDir)) {
        fs.mkdirSync(gitHooksDir, { recursive: true });
      }
      hookPath = path.join(gitHooksDir, 'pre-commit');
      hookType = 'git';
    }
  }

  let created = false;
  let updated = false;

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf8');
    if (!existing.includes('decision-tracker export --check')) {
      const isCrlf = existing.includes('\r\n');
      const eol = isCrlf ? '\r\n' : '\n';
      const newContent = existing.trimEnd() + eol + eol + '# decision-tracker sync check' + eol + hookCommand + eol;
      fs.writeFileSync(hookPath, newContent, 'utf8');
      updated = true;
    }
  } else {
    const content = '#!/bin/sh' + '\n' + '# decision-tracker sync check' + '\n' + hookCommand + '\n';
    fs.writeFileSync(hookPath, content, 'utf8');
    created = true;
  }

  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {}

  return {
    path: path.relative(baseDir, hookPath).replace(/\\/g, '/'),
    hookType,
    created,
    updated
  };
}
