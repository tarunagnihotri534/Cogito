import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  checkFileDecisions,
  getDecision,
  listDecisions,
  recordDecision
} from '../core/store.js';
import {
  DecisionConfidence,
  DecisionStatus,
  ListDecisionsSchema,
  QueryDecisionsSchema,
  RecordDecisionSchema
} from '../types/decision.js';
import { detectConflicts } from '../core/conflict.js';
import { searchDecisions } from '../core/search.js';
import { getDecisionTimeline } from '../core/timeline.js';
import { runDoctor } from '../core/doctor.js';
import { z } from 'zod';

export function createServer(baseDir: string = process.cwd()): Server {
  const server = new Server(
    {
      name: 'cogito',
      version: '0.1.1'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_decision',
          description: 'Retrieve full details of a specific architectural decision by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Decision ID (e.g. dec_20260212_abc123)'
              }
            },
            required: ['id']
          }
        },
        {
          name: 'list_decisions',
          description: 'List all stored architectural decisions with optional status and tag filtering.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['active', 'superseded', 'archived'],
                description: 'Filter by status'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags'
              }
            }
          }
        },
        {
          name: 'query_decisions',
          description: 'Find active architectural decisions relevant to a specific file path or tag set.',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Relative or absolute file path to check against decision scopes.'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags.'
              }
            }
          }
        },
        {
          name: 'record_decision',
          description: 'Record a new architectural decision for the codebase.',
          inputSchema: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'One-line summary of the decision' },
              rationale: { type: 'string', description: 'Why this decision was chosen' },
              scope: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns defining files/directories governed by this decision (e.g. src/api/**/*.ts)'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags (e.g., architecture, database, security)'
              },
              author: { type: 'string', description: 'Author of the decision' },
              context: { type: 'string', description: 'Optional background context' },
              consequences: { type: 'string', description: 'Optional consequences/trade-offs' },
              confidence: {
                type: 'string',
                enum: ['explicit', 'inferred', 'suggested'],
                description: 'Confidence level'
              },
              supersedes: {
                type: 'string',
                description: 'ID of an old decision superseded by this new decision'
              },
              reviewBy: {
                type: 'string',
                description: 'Optional scheduled review date (YYYY-MM-DD)'
              }
            },
            required: ['summary', 'rationale', 'scope']
          }
        },
        {
          name: 'search_decisions',
          description: 'Search architectural decisions across summaries, rationales, contexts, and tags with relevance scoring.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search keywords or phrases' },
              status: {
                type: 'string',
                enum: ['active', 'superseded', 'archived'],
                description: 'Optional status filter'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_timeline',
          description: 'Retrieve the evolution and supersession timeline for a decision ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Decision ID to trace' }
            },
            required: ['id']
          }
        },
        {
          name: 'doctor',
          description: 'Check decision health for staleness, dead globs, expired reviews, and broken links.',
          inputSchema: {
            type: 'object',
            properties: {
              strict: { type: 'boolean', description: 'Strict diagnostic mode' }
            }
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'query_decisions') {
        const input = QueryDecisionsSchema.parse(args || {});
        let results = [];
        if (input.file_path) {
          results = checkFileDecisions(baseDir, input.file_path);
        } else {
          results = listDecisions(baseDir, { status: 'active', tags: input.tags });
        }

        if (input.file_path && input.tags && input.tags.length > 0) {
          const filterTags = input.tags.map((t) => t.toLowerCase());
          results = results.filter((item) =>
            item.tags.some((tag) => filterTags.includes(tag.toLowerCase()))
          );
        }

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: 'No relevant decisions found.' }]
          };
        }

        const lines = [
          `Found ${results.length} relevant decision(s):`,
          ...results.map(
            (d) =>
              `- [ID: ${d.id}] ${d.summary}\n  Rationale: ${d.rationale}\n  Scope: ${d.scope.join(', ')}\n  Tags: ${d.tags.join(', ')}`
          )
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n\n') }]
        };
      }

      if (name === 'record_decision') {
        const parsed = RecordDecisionSchema.parse({
          summary: args?.summary,
          rationale: args?.rationale,
          scope: Array.isArray(args?.scope) ? args.scope : [args?.scope],
          tags: Array.isArray(args?.tags) ? args.tags : [],
          author: args?.author || 'anonymous',
          context: args?.context,
          consequences: args?.consequences,
          confidence: (args?.confidence as DecisionConfidence) || 'explicit',
          supersedes: args?.supersedes,
          reviewBy: args?.reviewBy
        });

        const conflicts = detectConflicts(baseDir, {
          summary: parsed.summary,
          scope: parsed.scope,
          tags: parsed.tags
        });

        const record = recordDecision(baseDir, parsed);
        let responseText = `Decision recorded [ID: ${record.id}]: ${record.summary}\nFile: ${record.filePath}`;

        if (conflicts.length > 0 && !parsed.supersedes) {
          responseText += `\n\n⚠️ Advisory: Potential conflict/overlap detected with active decision(s):\n`;
          for (const c of conflicts) {
            responseText += `- [${c.existingId}] ${c.existingSummary} (${c.reason})\n`;
          }
          responseText += `Consider superseding if this replaces prior architecture.`;
        }

        return {
          content: [
            {
              type: 'text',
              text: responseText
            }
          ]
        };
      }

      if (name === 'list_decisions') {
        const input = ListDecisionsSchema.parse(args || {});
        const results = listDecisions(baseDir, {
          status: input.status as DecisionStatus,
          tags: input.tags
        });

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: 'No decisions found.' }]
          };
        }

        const lines = [
          `Found ${results.length} decision(s):`,
          ...results.map(
            (d) =>
              `- [${d.id}] ${d.summary} (${d.status})\n  Scope: ${d.scope.join(', ')}\n  Tags: ${d.tags.join(', ')}`
          )
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n\n') }]
        };
      }

      if (name === 'get_decision') {
        const idSchema = z.object({ id: z.string() });
        const { id } = idSchema.parse(args);
        const record = getDecision(baseDir, id);

        if (!record) {
          return {
            content: [{ type: 'text', text: `Decision not found: ${id}` }]
          };
        }

        const textParts = [
          `ID: ${record.id}`,
          `Summary: ${record.summary}`,
          `Rationale: ${record.rationale}`,
          `Scope: ${record.scope.join(', ')}`,
          `Tags: ${record.tags.join(', ')}`,
          `Author: ${record.author}`,
          `Status: ${record.status}`,
          `Confidence: ${record.confidence || 'explicit'}`
        ];

        if (record.reviewBy) {
          textParts.push(`Review By: ${record.reviewBy}`);
        }
        if (record.context) {
          textParts.push(`## Context\n${record.context}`);
        }
        if (record.consequences) {
          textParts.push(`## Consequences\n${record.consequences}`);
        }

        return {
          content: [{ type: 'text', text: textParts.join('\n\n') }]
        };
      }

      if (name === 'search_decisions') {
        const searchSchema = z.object({
          query: z.string().min(1),
          status: z.enum(['active', 'superseded', 'archived']).optional()
        });
        const { query, status } = searchSchema.parse(args);
        const results = searchDecisions(baseDir, query, { status });

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No decisions matched query: "${query}"` }]
          };
        }

        const lines = [
          `Found ${results.length} decision(s) matching "${query}":`,
          ...results.map(
            (r) =>
              `- [${r.item.id}] ${r.item.summary} (${r.item.status}) [Score: ${r.score}]\n  Scope: ${r.item.scope.join(', ')}\n  Matched in: ${r.matchedFields.join(', ')}`
          )
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n\n') }]
        };
      }

      if (name === 'get_timeline') {
        const idSchema = z.object({ id: z.string() });
        const { id } = idSchema.parse(args);
        const timeline = getDecisionTimeline(baseDir, id);

        if (timeline.length === 0) {
          return {
            content: [{ type: 'text', text: `Decision not found: ${id}` }]
          };
        }

        const lines = [
          `Supersession Timeline for [${id}]:`,
          ...timeline.map(
            (n, idx) =>
              `${idx + 1}. [${n.id}] (${n.status}) ${n.summary}${n.supersededBy ? ` -> superseded by ${n.supersededBy}` : ''}`
          )
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n') }]
        };
      }

      if (name === 'doctor') {
        const strict = Boolean(args?.strict);
        const report = runDoctor({ baseDir, strict });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2)
            }
          ]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error executing tool '${name}': ${err.message}` }]
      };
    }
  });

  return server;
}

export async function runMcpServer(baseDir: string = process.cwd()) {
  const server = createServer(baseDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
