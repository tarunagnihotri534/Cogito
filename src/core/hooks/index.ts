import fs from 'fs';
import path from 'path';
import { checkFileDecisions, normalizePath } from '../store.js';
import { proposeFromTranscript, ProposedCandidate } from '../propose/index.js';

export interface PostToolUseResult {
  systemMessage?: string;
  matchedCount: number;
}

export interface SessionEndResult {
  proposedCount: number;
  candidateIds: string[];
  candidates: ProposedCandidate[];
}

export function handlePostToolUse(
  baseDir: string = process.cwd(),
  hookInput: any
): PostToolUseResult {
  const toolInput = hookInput?.tool_input || hookInput?.input || {};
  let filePath = toolInput.file_path || toolInput.path || toolInput.TargetFile || toolInput.filePath || '';

  if (!filePath || typeof filePath !== 'string') {
    return { matchedCount: 0 };
  }

  // Normalize path relative to baseDir
  filePath = normalizePath(filePath.trim());
  const normalizedBase = normalizePath(path.resolve(baseDir));
  if (filePath.startsWith(normalizedBase)) {
    filePath = filePath.slice(normalizedBase.length).replace(/^\//, '');
  }

  const matches = checkFileDecisions(baseDir, filePath);
  if (matches.length === 0) {
    return { matchedCount: 0 };
  }

  const summaries = matches
    .map((d) => `- ${d.summary} (scope: ${d.scope.join(', ')}) [ID: ${d.id}]`)
    .join('\n');

  const systemMessage = `Advisory: ${matches.length} existing architectural decision(s) may apply to this file:
${summaries}
Review with: cogito check ${filePath}
These are advisory — you may proceed, but consider whether your changes align with these decisions.`;

  return {
    systemMessage,
    matchedCount: matches.length
  };
}

export function handleSessionEnd(
  baseDir: string = process.cwd(),
  hookInput: any
): SessionEndResult {
  const transcriptPath = hookInput?.transcript_path || hookInput?.transcriptPath || '';
  const sessionId = hookInput?.session_id || hookInput?.sessionId;

  if (!transcriptPath || typeof transcriptPath !== 'string' || !fs.existsSync(transcriptPath)) {
    return {
      proposedCount: 0,
      candidateIds: [],
      candidates: []
    };
  }

  try {
    const res = proposeFromTranscript({
      baseDir,
      transcriptPath,
      sessionId
    });

    return {
      proposedCount: res.savedCount,
      candidateIds: res.proposed.map((p) => p.id),
      candidates: res.proposed
    };
  } catch (err) {
    return {
      proposedCount: 0,
      candidateIds: [],
      candidates: []
    };
  }
}

export async function readStdinJson(): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    if (process.stdin.isTTY) {
      resolve({});
      return;
    }

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        if (!data.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(data));
        }
      } catch {
        resolve({});
      }
    });

    process.stdin.on('error', () => {
      resolve({});
    });
  });
}
