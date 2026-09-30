const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function run() {
  const baseRef = process.env.BASE_REF || 'main';
  const scopeFilter = process.env.SCOPE_FILTER || '';
  const postComment = process.env.POST_COMMENT !== 'false';
  const githubToken = process.env.GITHUB_TOKEN;
  const prNumber = process.env.PR_NUMBER;
  const repo = process.env.REPO;
  const failOn = process.env.FAIL_ON || 'none';

  let diffOutput = '';
  try {
    diffOutput = execSync(`git diff --name-only origin/${baseRef}...HEAD`, { encoding: 'utf8' }).trim();
  } catch {
    try {
      diffOutput = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf8' }).trim();
    } catch {
      diffOutput = '';
    }
  }

  const changedFiles = diffOutput.split('\n').map((f) => f.trim()).filter(Boolean);
  if (changedFiles.length === 0) {
    console.log('No changed files detected.');
    return;
  }

  const indexPath = path.join(process.cwd(), '.decisions', 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.log('No .decisions/index.json found.');
    return;
  }

  const { minimatch } = require('minimatch');
  const decisions = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const activeDecisions = decisions.filter((d) => d.status === 'active');

  const matchesByFile = [];
  for (const file of changedFiles) {
    if (scopeFilter && !minimatch(file, scopeFilter, { dot: true })) continue;

    const matched = activeDecisions.filter(
      (d) =>
        d.scope &&
        d.scope.some((pattern) =>
          minimatch(file, pattern, { dot: true, matchBase: true })
        )
    );

    if (matched.length > 0) {
      matchesByFile.push({ file, decisions: matched });
    }
  }

  console.log(
    `Checked ${changedFiles.length} file(s); ${matchesByFile.length} file(s) matched architectural decisions.`
  );

  if (matchesByFile.length === 0) {
    console.log('No architectural decisions apply to changed files.');
    return;
  }

  const commentMarker = '<!-- decision-tracker-pr-comment -->';
  const lines = [
    commentMarker,
    '## 🏛️ Architectural Decisions Advisory',
    '',
    `This PR modifies **${matchesByFile.length}** file(s) governed by architectural decisions. Please ensure changes align with these established constraints:`,
    ''
  ];

  for (const item of matchesByFile) {
    lines.push(`### 📄 \`${item.file}\``);
    for (const d of item.decisions) {
      lines.push(`- **[${d.id}] ${d.summary}**`);
      lines.push(`  - *Rationale*: ${d.rationale}`);
      if (d.tags && d.tags.length > 0) {
        lines.push(`  - *Tags*: \`${d.tags.join('`, `')}\``);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Advisory context surfaced by [decision-tracker](https://github.com/tarunagnihotri534/Jennie).*');

  const commentBody = lines.join('\n');

  if (postComment && githubToken && prNumber && repo) {
    try {
      const headers = {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'decision-tracker-action'
      };

      const commentsUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
      const res = await fetch(commentsUrl, { headers });
      if (res.ok) {
        const comments = await res.json();
        const existing = comments.find((c) => c.body && c.body.includes(commentMarker));

        if (existing) {
          await fetch(`https://api.github.com/repos/${repo}/issues/comments/${existing.id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: commentBody })
          });
          console.log(`Updated sticky PR comment #${existing.id}.`);
        } else {
          await fetch(commentsUrl, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: commentBody })
          });
          console.log('Posted new sticky PR comment.');
        }
      }
    } catch (err) {
      console.warn('Failed to post/update PR comment:', err.message);
    }
  }

  if (failOn === 'warning' || failOn === 'error') {
    process.exitCode = 1;
  }
}

run();
