import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { fileURLToPath } from 'url';
import {
  checkFileDecisions,
  getDecision,
  initStorage,
  listDecisions,
  recordDecision,
  updateDecisionStatus
} from '../core/store.js';
import { importAdrs } from '../core/importers/adr.js';
import { runMcpServer } from '../mcp/server.js';
import { startDashboardServer } from '../dashboard/server.js';
import { DecisionConfidence, DecisionStatus } from '../types/decision.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('decision-tracker')
  .description('CLI tool for managing architectural codebase decisions')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize .decisions/ directory and install Claude Code hooks/commands')
  .action(() => {
    const baseDir = process.cwd();
    const { decisionsDir, createdDirs } = initStorage(baseDir);

    console.log(`✅ Initialized decision storage at ${decisionsDir}`);
    if (createdDirs.length > 0) {
      createdDirs.forEach((d) => console.log(`   Created directory: ${d}`));
    }

    // Find templates directory
    let templatesDir = path.resolve(__dirname, '../../templates');
    if (!fs.existsSync(templatesDir)) {
      templatesDir = path.resolve(baseDir, 'templates');
    }

    if (fs.existsSync(templatesDir)) {
      // 1. Copy check-decisions.sh to .claude/hooks/
      const hookSrc = path.join(templatesDir, 'hooks', 'check-decisions.sh');
      const hookDestDir = path.join(baseDir, '.claude', 'hooks');
      const hookDest = path.join(hookDestDir, 'check-decisions.sh');

      if (fs.existsSync(hookSrc)) {
        fs.mkdirSync(hookDestDir, { recursive: true });
        fs.copyFileSync(hookSrc, hookDest);
        try {
          fs.chmodSync(hookDest, 0o755);
        } catch {}
        console.log(`✅ Installed PostToolUse hook to .claude/hooks/check-decisions.sh`);
      }

      // 2. Copy decide.md to .claude/commands/
      const cmdSrc = path.join(templatesDir, 'commands', 'decide.md');
      const cmdDestDir = path.join(baseDir, '.claude', 'commands');
      const cmdDest = path.join(cmdDestDir, 'decide.md');

      if (fs.existsSync(cmdSrc)) {
        fs.mkdirSync(cmdDestDir, { recursive: true });
        fs.copyFileSync(cmdSrc, cmdDest);
        console.log(`✅ Installed /decide slash command to .claude/commands/decide.md`);
      }
    }

    console.log('\n🚀 Decision Tracker ready!');
  });

program
  .command('record')
  .description('Record a new architectural decision')
  .requiredOption('-s, --summary <summary>', 'One-line summary of the decision')
  .requiredOption('-r, --rationale <rationale>', 'Rationale behind the decision')
  .requiredOption('-c, --scope <globs...>', 'Glob pattern(s) matching governed files')
  .option('-t, --tags <tags...>', 'Tags for categorization', [])
  .option('-a, --author <author>', 'Author of the decision', 'anonymous')
  .option(
    '--confidence <level>',
    'Confidence level (explicit, inferred, suggested)',
    'explicit'
  )
  .option('--context <context>', 'Additional background context')
  .option('--consequences <consequences>', 'Expected consequences or trade-offs')
  .option('--supersedes <oldId>', 'ID of an old decision superseded by this one')
  .action((options) => {
    const baseDir = process.cwd();

    // Flatten comma-separated or space-separated tags/scopes
    const scope = options.scope.flatMap((s: string) => s.split(',').map((x) => x.trim()));
    const tags = options.tags.flatMap((t: string) => t.split(',').map((x) => x.trim()));

    const record = recordDecision(baseDir, {
      summary: options.summary,
      rationale: options.rationale,
      scope,
      tags,
      author: options.author,
      confidence: options.confidence as DecisionConfidence,
      context: options.context,
      consequences: options.consequences,
      supersedes: options.supersedes
    });

    console.log(`\n✅ Recorded decision ${record.id}`);
    console.log(`   File: ${record.filePath}`);
    console.log(`   Summary: ${record.summary}`);
    console.log(`   Scope: ${record.scope.join(', ')}`);
  });

program
  .command('check')
  .description('Check if a file matches any active architectural decision scopes')
  .argument('<file>', 'File path to check')
  .option('--json', 'Output results in JSON format')
  .action((file, options) => {
    const baseDir = process.cwd();
    const matches = checkFileDecisions(baseDir, file);

    if (options.json) {
      console.log(JSON.stringify(matches, null, 2));
      return;
    }

    if (matches.length === 0) {
      console.log(`ℹ️  No active architectural decisions match file '${file}'.`);
      return;
    }

    console.log(`\n⚠️  ${matches.length} Architectural Decision(s) match '${file}':\n`);
    matches.forEach((m) => {
      console.log(`--------------------------------------------------`);
      console.log(`ID:        ${m.id}`);
      console.log(`Summary:   ${m.summary}`);
      console.log(`Rationale: ${m.rationale}`);
      console.log(`Scope:     ${m.scope.join(', ')}`);
      console.log(`Tags:      ${m.tags.join(', ') || 'none'}`);
      console.log(`Author:    ${m.author}`);
      if (m.context) console.log(`Context:   ${m.context}`);
      if (m.consequences) console.log(`Consequences: ${m.consequences}`);
    });
    console.log(`--------------------------------------------------\n`);
  });

program
  .command('list')
  .description('List architectural decisions with optional filters')
  .option('--status <status>', 'Filter by status (active, superseded, archived)')
  .option('--tags <tags...>', 'Filter by tag(s)')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    const baseDir = process.cwd();

    const tags = options.tags
      ? options.tags.flatMap((t: string) => t.split(',').map((x) => x.trim()))
      : undefined;

    const items = listDecisions(baseDir, {
      status: options.status as DecisionStatus,
      tags
    });

    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }

    if (items.length === 0) {
      console.log('ℹ️  No decisions found matching the specified filters.');
      return;
    }

    console.log(`\n📋 Found ${items.length} Decision(s):\n`);
    items.forEach((item) => {
      const statusBadge =
        item.status === 'active'
          ? '🟢 active'
          : item.status === 'superseded'
            ? '🟡 superseded'
            : '🔴 archived';

      console.log(`• [${item.id}] ${statusBadge}`);
      console.log(`  Summary:   ${item.summary}`);
      console.log(`  Scope:     ${item.scope.join(', ')}`);
      console.log(`  Tags:      ${item.tags.join(', ') || 'none'}`);
      console.log(`  Created:   ${item.created}`);
      if (item.supersededBy) console.log(`  Superseded By: ${item.supersededBy}`);
      console.log('');
    });
  });

program
  .command('get')
  .description('View detailed decision information by ID')
  .argument('<id>', 'Decision ID (e.g. dec_20260212_abc123)')
  .option('--json', 'Output in JSON format')
  .action((id, options) => {
    const baseDir = process.cwd();
    const record = getDecision(baseDir, id);

    if (!record) {
      console.error(`❌ Decision '${id}' not found.`);
      process.exitCode = 1;
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    console.log(`\n==================================================`);
    console.log(`DECISION: ${record.id}`);
    console.log(`Summary:  ${record.summary}`);
    console.log(`Status:   ${record.status}`);
    console.log(`Author:   ${record.author}`);
    console.log(`Created:  ${record.created}`);
    console.log(`Scope:    ${record.scope.join(', ')}`);
    console.log(`Tags:     ${record.tags.join(', ') || 'none'}`);
    if (record.supersededBy) console.log(`Superseded By: ${record.supersededBy}`);
    console.log(`==================================================\n`);
    console.log(record.body);
  });

program
  .command('import')
  .description('Import architectural decisions from external formats (e.g. ADRs)')
  .requiredOption('--from <format>', 'Source format to import from (supported: adr)')
  .argument('<dir>', 'Directory containing ADR files to import')
  .option('--default-scope <glob>', 'Explicit default glob scope if none can be inferred from ADR text')
  .option('--dry-run', 'Simulate import without writing any files')
  .option('--json', 'Output results in JSON format')
  .action(async (dir, options) => {
    const baseDir = process.cwd();

    if (options.from.toLowerCase() !== 'adr') {
      console.error(`Error: Unsupported import format '${options.from}'. Supported formats: adr`);
      process.exitCode = 1;
      return;
    }

    try {
      const result = await importAdrs(baseDir, {
        dir,
        defaultScope: options.defaultScope,
        dryRun: Boolean(options.dryRun)
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const prefix = options.dryRun ? '[DRY-RUN] ' : '';
      console.log(`\n${prefix}ADR Import Summary for '${dir}':`);
      console.log(`  Found:      ${result.totalFound} ADR file(s)`);
      console.log(`  Imported:   ${result.imported.length}`);
      console.log(`  Skipped:    ${result.skipped.length}`);
      console.log(`  Superseded: ${result.supersededCount} link(s) resolved`);

      if (result.needsScopeCount > 0) {
        console.log(`\n⚠️  ${result.needsScopeCount} decision(s) imported without an inferred scope (tagged 'needs-scope').`);
        console.log(`   Configure scopes for these decisions to enable file matching.`);
      }

      if (result.imported.length > 0) {
        console.log(`\nImported Decisions:`);
        result.imported.forEach((item) => {
          const scopeStr = item.scope.length > 0 ? item.scope.join(', ') : '(no scope - tagged needs-scope)';
          const statusStr = item.supersededBy ? `superseded by ${item.supersededBy}` : item.status;
          console.log(`  • [${item.id}] (${statusStr}) ${item.summary}`);
          console.log(`    Scope:  ${scopeStr}`);
          console.log(`    Source: ${item.adrPath}`);
        });
      }

      if (result.skipped.length > 0) {
        console.log(`\nSkipped ADRs:`);
        result.skipped.forEach((s) => {
          console.log(`  • ${s.adrPath} (${s.reason})`);
        });
      }

      console.log('');
    } catch (err: any) {
      if (options.json) {
        console.log(JSON.stringify({ error: err.message }, null, 2));
      } else {
        console.error(`\n❌ Import failed: ${err.message}\n`);
      }
      process.exitCode = 1;
    }
  });

program
  .command('serve')
  .description('Start the Model Context Protocol (MCP) server over stdio')
  .action(async () => {
    await runMcpServer(process.cwd());
  });

program
  .command('dashboard')
  .description('Start the local React web dashboard server')
  .option('-p, --port <port>', 'Port to run the dashboard server on', '3333')
  .option('--no-open', 'Do not automatically open the browser')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const serverUrl = `http://localhost:${port}`;

    startDashboardServer(process.cwd(), port, () => {
      console.log(`\n🌐 Decision Tracker Dashboard running at: ${serverUrl}\n`);
      if (options.open) {
        open(serverUrl).catch(() => {});
      }
    });
  });

program.parse(process.argv);
