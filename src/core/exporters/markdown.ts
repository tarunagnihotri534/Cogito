import { DecisionIndexItem } from '../../types/decision.js';

export interface FormatOptions {
  maxDecisions?: number;
  maxRationaleLen?: number;
}

export function formatDecisionsMarkdown(
  decisions: DecisionIndexItem[],
  options: FormatOptions = {}
): string {
  const maxDecisions = options.maxDecisions ?? 50;
  const maxRationaleLen = options.maxRationaleLen ?? 300;

  // Filter only active decisions and sort deterministically: created desc, then id asc
  const active = decisions
    .filter((d) => d.status === 'active')
    .sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return a.id.localeCompare(b.id);
    });

  if (active.length === 0) {
    return '## Architectural Decisions\n\nNo active architectural decisions tracked.';
  }

  const lines: string[] = [
    '## Architectural Decisions',
    '',
    '> Advisory architectural decisions tracked by decision-tracker. Consult before modifying matching files.',
    ''
  ];

  const sliced = active.slice(0, maxDecisions);

  for (const dec of sliced) {
    const scopeStr =
      dec.scope && dec.scope.length > 0
        ? dec.scope.map((s) => '`' + s + '`').join(', ')
        : 'All files (`needs-scope`)';

    let rationale = dec.rationale.trim();
    if (rationale.length > maxRationaleLen) {
      rationale = rationale.slice(0, maxRationaleLen).trim() + '...';
    }

    lines.push(`### [${dec.id}] ${dec.summary}`);
    lines.push(`- **Scope**: ${scopeStr}`);
    lines.push(`- **Rationale**: ${rationale}`);
    if (dec.tags && dec.tags.length > 0) {
      lines.push(`- **Tags**: ${dec.tags.map((t) => '`' + t + '`').join(', ')}`);
    }
    if (dec.confidence && dec.confidence !== 'explicit') {
      lines.push(`- **Confidence**: ${dec.confidence}`);
    }
    lines.push('');
  }

  if (active.length > maxDecisions) {
    lines.push(
      `> ... and ${active.length - maxDecisions} more active decisions. Run \`decision-tracker list\` to view all.`
    );
    lines.push('');
  }

  return lines.join('\n').trim();
}
