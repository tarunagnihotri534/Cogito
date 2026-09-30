import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { checkFileDecisions, listDecisions, normalizePath } from './store.js';
import { DecisionIndexItem, DecisionStatus } from '../types/decision.js';

export interface WorkspacePackage {
  name: string;
  absPath: string;
  relPath: string;
  hasDecisions: boolean;
}

export interface MonorepoDecisionMatch extends DecisionIndexItem {
  origin: 'package' | 'root';
  packageName?: string;
  packageRelPath?: string;
}

export function isMonorepo(rootDir: string = process.cwd()): boolean {
  if (
    fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml')) ||
    fs.existsSync(path.join(rootDir, 'lerna.json')) ||
    fs.existsSync(path.join(rootDir, 'turbo.json')) ||
    fs.existsSync(path.join(rootDir, 'nx.json'))
  ) {
    return true;
  }

  const pkgJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.workspaces && (Array.isArray(pkg.workspaces) || Array.isArray(pkg.workspaces.packages))) {
        return true;
      }
    } catch {}
  }

  return false;
}

export function findMonorepoRoot(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    if (isMonorepo(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

export function discoverWorkspaces(rootDir: string = process.cwd()): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  const searchPatterns: string[] = [];

  // Check pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspacePath)) {
    try {
      const yaml = fs.readFileSync(pnpmWorkspacePath, 'utf8');
      const lines = yaml.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("-") || trimmed.startsWith("'") || trimmed.startsWith('"')) {
          const cleaned = trimmed.replace(/^-s*/, '').replace(/['"]/g, '').trim();
          if (cleaned && !cleaned.startsWith('#') && !cleaned.includes('packages:')) {
            searchPatterns.push(cleaned);
          }
        }
      }
    } catch {}
  }

  // Check package.json workspaces
  const pkgJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const ws = Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : Array.isArray(pkg.workspaces?.packages)
        ? pkg.workspaces.packages
        : [];
      searchPatterns.push(...ws);
    } catch {}
  }

  if (searchPatterns.length === 0) {
    searchPatterns.push('packages/*', 'apps/*', 'libs/*');
  }

  // Find directories matching patterns that contain package.json or .decisions
  const visited = new Set<string>();

  for (const pattern of searchPatterns) {
    const baseFolder = pattern.split('/')[0];
    const baseDir = path.join(rootDir, baseFolder);
    if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) continue;

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPackagePath = path.join(baseDir, entry.name);
      const relPath = normalizePath(path.relative(rootDir, fullPackagePath));

      if (visited.has(fullPackagePath)) continue;
      visited.add(fullPackagePath);

      let name = entry.name;
      const innerPkgJson = path.join(fullPackagePath, 'package.json');
      if (fs.existsSync(innerPkgJson)) {
        try {
          const innerPkg = JSON.parse(fs.readFileSync(innerPkgJson, 'utf8'));
          if (innerPkg.name) name = innerPkg.name;
        } catch {}
      }

      const hasDecisions = fs.existsSync(path.join(fullPackagePath, '.decisions'));
      packages.push({
        name,
        absPath: fullPackagePath,
        relPath,
        hasDecisions
      });
    }
  }

  return packages;
}

export function checkMonorepoFileDecisions(
  rootDir: string = process.cwd(),
  filePath: string
): MonorepoDecisionMatch[] {
  const normFilePath = normalizePath(filePath);
  const absFilePath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(rootDir, filePath);
  const relToRoot = normalizePath(path.relative(rootDir, absFilePath));

  const workspaces = discoverWorkspaces(rootDir);
  const matches: MonorepoDecisionMatch[] = [];

  // Find if file belongs to a workspace package
  let matchedWorkspace: WorkspacePackage | undefined;
  for (const ws of workspaces) {
    const wsRel = ws.relPath;
    if (relToRoot === wsRel || relToRoot.startsWith(wsRel + '/')) {
      matchedWorkspace = ws;
      break;
    }
  }

  // 1. Package-level decisions (highest precedence)
  if (matchedWorkspace && matchedWorkspace.hasDecisions) {
    const fileRelToPackage = normalizePath(
      path.relative(matchedWorkspace.absPath, absFilePath)
    );
    const packageDecisions = checkFileDecisions(matchedWorkspace.absPath, fileRelToPackage);

    for (const dec of packageDecisions) {
      matches.push({
        ...dec,
        origin: 'package',
        packageName: matchedWorkspace.name,
        packageRelPath: matchedWorkspace.relPath
      });
    }
  }

  // 2. Root-level decisions
  const rootDecisions = checkFileDecisions(rootDir, relToRoot);
  for (const dec of rootDecisions) {
    // Avoid duplicate IDs if package overridden
    if (!matches.some((m) => m.id === dec.id)) {
      matches.push({
        ...dec,
        origin: 'root'
      });
    }
  }

  return matches;
}

export function listAllMonorepoDecisions(
  rootDir: string = process.cwd(),
  filters?: { status?: DecisionStatus; tags?: string[] }
): MonorepoDecisionMatch[] {
  const all: MonorepoDecisionMatch[] = [];
  const seenIds = new Set<string>();

  // 1. Root decisions
  const rootDecisions = listDecisions(rootDir, filters);
  for (const dec of rootDecisions) {
    seenIds.add(dec.id);
    all.push({
      ...dec,
      origin: 'root'
    });
  }

  // 2. Workspace packages decisions
  const workspaces = discoverWorkspaces(rootDir);
  for (const ws of workspaces) {
    if (!ws.hasDecisions) continue;
    const wsDecisions = listDecisions(ws.absPath, filters);
    for (const dec of wsDecisions) {
      if (!seenIds.has(dec.id)) {
        seenIds.add(dec.id);
        all.push({
          ...dec,
          origin: 'package',
          packageName: ws.name,
          packageRelPath: ws.relPath
        });
      }
    }
  }

  return all;
}
