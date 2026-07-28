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
import { z } from 'zod';

export function createServer(baseDir: string = process.cwd()): Server {
  const server = new Server(
    {
      name: 'decision-tracker',
      version: '1.0.0'
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
              }
            },
            required: ['summary', 'rationale', 'scope']
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
          supersedes: args?.supersedes
        });

        const record = recordDecision(baseDir, parsed);
        return {
          content: [
            {
              type: 'text',
              text: `Decision recorded [ID: ${record.id}]: ${record.summary}\nFile: ${record.filePath}`
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
