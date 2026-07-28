import { z } from 'zod';

export type DecisionStatus = 'active' | 'superseded' | 'archived';
export type DecisionConfidence = 'explicit' | 'inferred' | 'suggested';

export interface DecisionFrontmatter {
  id: string;
  summary: string;
  rationale: string;
  scope: string[];
  tags: string[];
  author: string;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  created: string;
  context?: string;
  consequences?: string;
  supersededBy?: string;
}

export interface DecisionRecord extends DecisionFrontmatter {
  filePath: string;
  body: string;
}

export interface DecisionIndexItem {
  id: string;
  summary: string;
  rationale: string;
  scope: string[];
  tags: string[];
  author: string;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  created: string;
  filePath: string;
  context?: string;
  consequences?: string;
  supersededBy?: string;
}

export const DecisionStatusSchema = z.enum(['active', 'superseded', 'archived']);
export const DecisionConfidenceSchema = z.enum(['explicit', 'inferred', 'suggested']);

export const RecordDecisionSchema = z.object({
  summary: z.string().min(1, 'Summary is required'),
  rationale: z.string().min(1, 'Rationale is required'),
  scope: z.array(z.string()).min(1, 'At least one glob scope is required'),
  tags: z.array(z.string()).default([]),
  author: z.string().default('anonymous'),
  confidence: DecisionConfidenceSchema.default('explicit'),
  context: z.string().optional(),
  consequences: z.string().optional(),
  status: DecisionStatusSchema.optional().default('active'),
  supersedes: z.string().optional() // ID of old decision if superseding
});

export type RecordDecisionInput = z.input<typeof RecordDecisionSchema>;

export const QueryDecisionsSchema = z.object({
  file_path: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export type QueryDecisionsInput = z.infer<typeof QueryDecisionsSchema>;

export const ListDecisionsSchema = z.object({
  status: DecisionStatusSchema.optional(),
  tags: z.array(z.string()).optional()
});

export type ListDecisionsInput = z.infer<typeof ListDecisionsSchema>;
