import readline from 'readline/promises';
import {
  loadInboxCandidates,
  approveInboxCandidate,
  removeInboxCandidate,
  ProposedCandidate
} from './inbox.js';

export interface CliReviewOptions {
  baseDir?: string;
  yes?: boolean;
  minScore?: number;
  list?: boolean;
  json?: boolean;
}

export async function runReviewCli(options: CliReviewOptions): Promise<void> {
  const baseDir = options.baseDir || process.cwd();
  const candidates = loadInboxCandidates(baseDir);

  if (options.json) {
    console.log(JSON.stringify(candidates, null, 2));
    return;
  }

  if (candidates.length === 0) {
    console.log('\nℹ️  No pending decision proposals found in inbox (.decisions/.inbox/).\n');
    return;
  }

  if (options.list) {
    console.log(`\n📥 Found ${candidates.length} Decision Proposal(s) in Inbox:\n`);
    for (const c of candidates) {
      console.log(`• [${c.id}] (Score: ${c.score.toFixed(2)})`);
      console.log(`  Summary:   ${c.summary}`);
      console.log(`  Scope:     ${c.scope.length > 0 ? c.scope.join(', ') : '(needs-scope)'}`);
      console.log(`  Rationale: ${c.rationale}`);
      console.log(`  Created:   ${c.created}`);
      console.log('');
    }
    return;
  }

  const minScore = options.minScore ?? 0.75;

  if (options.yes) {
    let approvedCount = 0;
    let skippedCount = 0;

    for (const c of candidates) {
      if (c.score >= minScore) {
        approveInboxCandidate(baseDir, c.id);
        console.log(`✔ Approved [${c.id}] (score: ${c.score.toFixed(2)} >= ${minScore}): ${c.summary}`);
        approvedCount++;
      } else {
        console.log(`⏭ Skipped [${c.id}] (score: ${c.score.toFixed(2)} < ${minScore}): ${c.summary}`);
        skippedCount++;
      }
    }

    console.log(`\nSummary: ${approvedCount} approved, ${skippedCount} remaining below threshold (${minScore}).\n`);
    return;
  }

  // Check if stdin is a TTY
  if (!process.stdin.isTTY) {
    console.log(`Found ${candidates.length} candidate(s) in inbox.`);
    console.log(`Non-interactive session detected. Use '--yes' to auto-accept candidates above threshold (${minScore}) or '--list' to inspect.`);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`\n📋 Reviewing ${candidates.length} decision proposal(s) in inbox:\n`);

  try {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      console.log('='.repeat(60));
      console.log(`[${i + 1}/${candidates.length}] Proposed Decision: ${c.id}`);
      console.log(`Confidence Score: ${c.score.toFixed(2)}`);
      console.log(`Summary:          ${c.summary}`);
      console.log(`Scope:            ${c.scope.length > 0 ? c.scope.join(', ') : '(none)'}`);
      console.log(`Tags:             ${c.tags.length > 0 ? c.tags.join(', ') : '(none)'}`);
      console.log(`Rationale:        ${c.rationale}`);
      if (c.context) {
        console.log(`Context:          ${c.context.slice(0, 150)}...`);
      }
      console.log('='.repeat(60));

      let resolved = false;
      while (!resolved) {
        const answer = (
          await rl.question('\nAction: [a]pprove, [e]dit, [r]eject, [s]kip, [q]uit: ')
        )
          .trim()
          .toLowerCase();

        if (answer === 'a') {
          approveInboxCandidate(baseDir, c.id);
          console.log(`\n✔ Approved and recorded decision: ${c.summary}\n`);
          resolved = true;
        } else if (answer === 'e') {
          console.log('\nEditing proposal (press Enter to keep existing value):');
          const newSummary = await rl.question(`Summary [${c.summary}]: `);
          const newScopeStr = await rl.question(
            `Scope (comma-separated) [${c.scope.join(', ')}]: `
          );
          const newRationale = await rl.question(`Rationale [${c.rationale}]: `);

          const overrides: Partial<ProposedCandidate> = {};
          if (newSummary.trim().length > 0) {
            overrides.summary = newSummary.trim();
          }
          if (newScopeStr.trim().length > 0) {
            overrides.scope = newScopeStr.split(',').map((s) => s.trim()).filter(Boolean);
          }
          if (newRationale.trim().length > 0) {
            overrides.rationale = newRationale.trim();
          }

          approveInboxCandidate(baseDir, c.id, overrides);
          console.log(`\n✔ Edited and recorded decision: ${overrides.summary || c.summary}\n`);
          resolved = true;
        } else if (answer === 'r') {
          removeInboxCandidate(baseDir, c.id);
          console.log(`\n✖ Rejected and removed proposal: ${c.id}\n`);
          resolved = true;
        } else if (answer === 's') {
          console.log('\n⏭ Skipped for later.\n');
          resolved = true;
        } else if (answer === 'q') {
          console.log('\nExiting review.\n');
          return;
        } else {
          console.log('Invalid option. Please enter a, e, r, s, or q.');
        }
      }
    }
  } finally {
    rl.close();
  }

  console.log('Review completed.');
}
