/**
 * Campaign templates: the built-in campaign types. A template is not a form a business designs; it is a
 * type (quiz, survey, giveaway, instant win) that says which kinds of field a campaign of that type may
 * use, how many, and what a new campaign starts with. The campaign holds the actual content.
 *
 * The vocabulary here is the API's (lowercase ids); the database enums are the uppercase forms.
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
  'long_text',
  'consent',
  'quiz_question',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** `details` are what a participant is asked about themselves; `content` is what the campaign is about. */
export type FieldGroup = 'details' | 'content';
const CONTENT_KINDS: ReadonlySet<FieldKind> = new Set([
  'choice',
  'likert',
  'text',
  'long_text',
  'quiz_question',
]);
export const groupOf = (kind: FieldKind): FieldGroup =>
  CONTENT_KINDS.has(kind) ? 'content' : 'details';

/** One field kind a template allows. */
export type AllowedField = {
  kind: FieldKind;
  group: FieldGroup;
  /** Most a campaign may have of this kind; null means no limit. */
  maxCount: number | null;
  /** How many a new campaign of this type starts with. */
  defaultCount: number;
  defaultLabel: string;
  defaultRequired: boolean;
};

export type CampaignTemplate = {
  id: string;
  slug: string;
  name: string;
  archetype: Archetype;
  description: string;
  /** A campaign needs at least this many content fields (questions) to launch. */
  minContentFields: number;
  /** A campaign of this type must say what is being given away. */
  requiresPrizes: boolean;
  fields: AllowedField[];
};
