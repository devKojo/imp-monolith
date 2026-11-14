/**
 * Campaign templates: a reusable blueprint of what a participant is asked when they enter a
 * campaign. Hand-written types for now; replace with the generated client when the templates API
 * exists (nothing is persisted yet, see sample.ts).
 */
export const ARCHETYPES = ['giveaway', 'quiz', 'survey', 'instant'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const BLOCK_KINDS = [
  'full_name',
  'email',
  'phone',
  'address',
  'wallet',
  'choice',
  'likert',
  'upload',
  'text',
  'consent',
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

export type TemplateBlock = {
  id: string;
  kind: BlockKind;
  /** Machine name of the field in the entry schema (snake_case, unique in the template). */
  key: string;
  label: string;
  helper: string;
  required: boolean;
  /** Answers for a multiple choice question. */
  options: string[];
};

export type CampaignTemplate = {
  id: string;
  name: string;
  archetype: Archetype;
  status: TemplateStatus;
  blocks: TemplateBlock[];
  /** ISO timestamp of the last save. */
  updatedAt: string;
};

export type PreflightId = 'fields' | 'identity' | 'consent' | 'labels';
export type PreflightCheck = { id: PreflightId; pass: boolean };

export type StageId = 'archetype' | 'fields' | 'checks' | 'publish';
export type StageStatus = 'notStarted' | 'inProgress' | 'complete' | 'issues';
