/**
 * Campaign templates: a reusable blueprint of what a participant is asked when they enter a
 * campaign. The vocabulary here is the API's (lowercase ids); the database enums are the uppercase
 * forms, mapped in the repository.
 */
export const ARCHETYPES = ['giveaway', 'quiz', 'survey', 'instant'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const FIELD_KINDS = [
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
export type FieldKind = (typeof FIELD_KINDS)[number];

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

export const LIMITS = {
  nameMax: 120,
  labelMax: 120,
  helperMax: 240,
  optionMax: 120,
  fieldsMax: 30,
  optionsMax: 10,
  /** A choice question needs at least this many answers before the template can be published. */
  optionsMinToPublish: 2,
} as const;

/** What the client sends for one field; `id` is assigned by the server. */
export type FieldInput = {
  kind: FieldKind;
  /** Machine name in the entry schema: snake_case, unique within the template. */
  key: string;
  label: string;
  helper: string;
  required: boolean;
  /** Answers for a `choice` field; empty for every other kind. */
  options: string[];
};
export type TemplateField = FieldInput & { id: string };

export type TemplateSummary = {
  id: string;
  name: string;
  archetype: Archetype;
  status: TemplateStatus;
  version: number;
  fieldCount: number;
  updatedAt: string;
  publishedAt: string | null;
};

export type TemplateDetail = Omit<TemplateSummary, 'fieldCount'> & { fields: TemplateField[] };

export type PreflightId = 'fields' | 'identity' | 'consent' | 'labels';
export type PreflightCheck = { id: PreflightId; pass: boolean };

/** The signed-in person acting on a business, resolved by the session, never by the request. */
export type Actor = { userId: string; tenantId: string; role: string };
