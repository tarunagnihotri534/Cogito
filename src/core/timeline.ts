import { loadIndex } from './store.js';
import { DecisionIndexItem } from '../types/decision.js';

export interface TimelineNode {
  id: string;
  summary: string;
  status: string;
  created: string;
  supersededBy?: string;
  supersedes?: string[];
  rationale?: string;
}

export function getDecisionTimeline(
  baseDir: string = process.cwd(),
  decisionId: string
): TimelineNode[] {
  const index = loadIndex(baseDir);
  const decisionMap = new Map<string, DecisionIndexItem>();
  for (const d of index) {
    decisionMap.set(d.id, d);
  }

  const target = decisionMap.get(decisionId);
  if (!target) {
    return [];
  }

  // 1. Trace backwards: find ancestors (what this decision supersedes)
  const ancestors: DecisionIndexItem[] = [];
  let currentId: string | undefined = decisionId;

  // Build a reverse map: who superseded whom?
  // If B was supersededBy C, then C supersedes B
  const supersededByMap = new Map<string, DecisionIndexItem[]>();
  for (const d of index) {
    if (d.supersededBy) {
      const list = supersededByMap.get(d.supersededBy) || [];
      list.push(d);
      supersededByMap.set(d.supersededBy, list);
    }
  }

  function collectAncestors(id: string) {
    const directPredecessors = supersededByMap.get(id) || [];
    for (const pred of directPredecessors) {
      if (!ancestors.some((a) => a.id === pred.id)) {
        ancestors.push(pred);
        collectAncestors(pred.id);
      }
    }
  }
  collectAncestors(decisionId);

  // 2. Trace forwards: find descendants (what superseded this decision)
  const descendants: DecisionIndexItem[] = [];
  let nextTargetId = target.supersededBy;
  while (nextTargetId && decisionMap.has(nextTargetId)) {
    const nextItem = decisionMap.get(nextTargetId)!;
    if (descendants.some((d) => d.id === nextItem.id)) break; // cycle protection
    descendants.push(nextItem);
    nextTargetId = nextItem.supersededBy;
  }

  // Combine ancestors (oldest first), target, descendants (newest last)
  ancestors.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

  const fullChain = [...ancestors, target, ...descendants];

  return fullChain.map((item) => {
    const directPreds = supersededByMap.get(item.id) || [];
    return {
      id: item.id,
      summary: item.summary,
      status: item.status,
      created: item.created,
      supersededBy: item.supersededBy,
      supersedes: directPreds.map((p) => p.id),
      rationale: item.rationale
    };
  });
}
