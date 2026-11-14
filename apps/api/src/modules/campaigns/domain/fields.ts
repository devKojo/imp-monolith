/**
 * The fields of a campaign: what a participant is asked about themselves (`details`) and what the
 * campaign is about (`content`: quiz and survey questions). Which kinds a campaign may use, and how many,
 * comes from its template; the content itself belongs to the campaign. The API's ids are lowercase; the
 * database enum is the uppercase form, mapped in the repository.
 */
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

/** Kinds whose answers are a list of options the participant picks from. */
const CHOICE_KINDS: ReadonlySet<FieldKind> = new Set(['choice', 'quiz_question']);
export const hasOptions = (kind: FieldKind): boolean => CHOICE_KINDS.has(kind);

export const FIELD_LIMITS = {
  /** Participant details are short labels. */
  labelMax: 120,
  /** A question's text can be longer. */
  promptMax: 300,
  helperMax: 240,
  optionMax: 120,
  /** Answers to a survey choice. */
  optionsMax: 20,
  /** Answers to a quiz question (one is correct). */
  quizOptionsMax: 6,
  optionsMin: 2,
  /** All fields of one campaign. */
  fieldsMax: 60,
  /** Questions (content fields) of one campaign. */
  contentMax: 50,
  timeLimitMax: 240,
  defaultPassPercent: 70,
} as const;

/** What the client sends for one field; the machine `key` is made by the server. */
export type FieldDraft = {
  kind: FieldKind;
  label: string;
  helper: string;
  required: boolean;
  /** Answers of a choice or quiz question; empty for every other kind. */
  options: string[];
  /** Index of the correct answer of a quiz question; null until one is marked, and null for other kinds. */
  correctIndex: number | null;
};

/** A field as stored: with its machine name (snake_case, unique in the campaign) and its id. */
export type FieldInput = FieldDraft & { key: string };
export type CampaignField = FieldInput & { id: string };

export type QuizSettings = {
  /** Minutes for the whole attempt; null means untimed. */
  timeLimitMinutes: number | null;
  passPercent: number;
};
/** Settings the campaign type uses; `quiz` is only set for a quiz campaign. */
export type CampaignSettings = { quiz?: QuizSettings };

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  timeLimitMinutes: null,
  passPercent: FIELD_LIMITS.defaultPassPercent,
};
