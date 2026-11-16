import type {
  AllowedField,
  CampaignField,
  CampaignSettings,
  FieldGroup,
  FieldKind,
  QuizSettings,
  TemplateRef,
} from './types';

/** Pure helpers for the fields of a campaign: every function returns new data and never mutates. */

export const FIELD_LIMITS = {
  label: 120,
  prompt: 300,
  helper: 240,
  option: 120,
  optionsMin: 2,
  optionsMax: 20,
  quizOptionsMax: 6,
  fields: 60,
  content: 50,
  timeLimitMax: 240,
  defaultPassPercent: 70,
  maxAttemptsMax: 5,
  defaultMaxAttempts: 1,
} as const;

const CONTENT: ReadonlySet<FieldKind> = new Set([
  'choice',
  'likert',
  'text',
  'long_text',
  'quiz_question',
]);
export const groupOf = (kind: FieldKind): FieldGroup => (CONTENT.has(kind) ? 'content' : 'details');
/** Kinds whose answers are a list of options to pick from. */
export const hasOptions = (kind: FieldKind): boolean =>
  kind === 'choice' || kind === 'quiz_question';
/** Most answers a field of this kind can have. */
export const maxOptions = (kind: FieldKind): number =>
  kind === 'quiz_question' ? FIELD_LIMITS.quizOptionsMax : FIELD_LIMITS.optionsMax;
/** The longest label: a question's text is longer than a participant-detail label. */
export const maxLabel = (kind: FieldKind): number =>
  groupOf(kind) === 'content' ? FIELD_LIMITS.prompt : FIELD_LIMITS.label;

export const fieldsOf = (fields: readonly CampaignField[], group: FieldGroup): CampaignField[] =>
  fields.filter((f) => groupOf(f.kind) === group);

/** A new field of a kind, starting from what the template says (label, required). */
export function newField(kind: FieldKind, template: TemplateRef | null, id: string): CampaignField {
  const rule = template?.fields.find((a) => a.kind === kind);
  return {
    id,
    kind,
    key: '',
    label: rule?.defaultLabel ?? '',
    helper: '',
    required: kind === 'quiz_question' ? true : (rule?.defaultRequired ?? false),
    options: hasOptions(kind) ? ['', ''] : [],
    correctIndex: null,
  };
}

/** The kinds a campaign may still add: allowed by its template and not yet at the limit. */
export function addable(
  template: TemplateRef | null,
  fields: readonly CampaignField[],
  group: FieldGroup,
): AllowedField[] {
  if (!template || fields.length >= FIELD_LIMITS.fields) return [];
  if (group === 'content' && fieldsOf(fields, 'content').length >= FIELD_LIMITS.content) return [];
  return template.fields.filter(
    (a) =>
      a.group === group &&
      (a.maxCount === null || fields.filter((f) => f.kind === a.kind).length < a.maxCount),
  );
}

/** What a new campaign of this type starts with. */
export function startingFields(template: TemplateRef, uid: () => string): CampaignField[] {
  return template.fields.flatMap((a) =>
    Array.from({ length: a.defaultCount }, () => newField(a.kind, template, uid())),
  );
}

/**
 * Moving a draft to another type: keep what the new type allows (up to its limits), and begin from the
 * type's defaults if nothing is left to keep.
 */
export function fitToTemplate(
  fields: readonly CampaignField[],
  template: TemplateRef,
  uid: () => string,
): CampaignField[] {
  const kept: CampaignField[] = [];
  for (const f of fields) {
    const rule = template.fields.find((a) => a.kind === f.kind);
    if (!rule) continue;
    if (rule.maxCount !== null && kept.filter((k) => k.kind === f.kind).length >= rule.maxCount) {
      continue;
    }
    kept.push(f);
  }
  return kept.length > 0 ? kept : startingFields(template, uid);
}

export const defaultSettingsFor = (template: TemplateRef | null): CampaignSettings =>
  template?.archetype === 'quiz' ? { quiz: { ...DEFAULT_QUIZ } } : {};

/** A quiz as it starts: untimed, the usual pass mark, one attempt. */
const DEFAULT_QUIZ: QuizSettings = {
  timeLimitMinutes: null,
  passPercent: FIELD_LIMITS.defaultPassPercent,
  maxAttempts: FIELD_LIMITS.defaultMaxAttempts,
};

/** The quiz settings of a campaign, filling in what an older campaign does not have. */
export const quizSettingsOf = (settings: CampaignSettings): QuizSettings => ({
  ...DEFAULT_QUIZ,
  ...settings.quiz,
});

export const addField = (fields: readonly CampaignField[], field: CampaignField) => [
  ...fields,
  field,
];

export const removeField = (fields: readonly CampaignField[], id: string): CampaignField[] =>
  fields.filter((f) => f.id !== id);

export const updateField = (
  fields: readonly CampaignField[],
  id: string,
  patch: Partial<Omit<CampaignField, 'id' | 'kind'>>,
): CampaignField[] => fields.map((f) => (f.id === id ? { ...f, ...patch } : f));

/**
 * Moves a field up or down among the fields of its own group, so a question never jumps into the
 * participant details. Fields of the other group keep their places.
 */
export function moveField(
  fields: readonly CampaignField[],
  id: string,
  direction: -1 | 1,
): CampaignField[] {
  const target = fields.find((f) => f.id === id);
  if (!target) return [...fields];
  const group = groupOf(target.kind);
  const sameGroup = fields.filter((f) => groupOf(f.kind) === group);
  const from = sameGroup.findIndex((f) => f.id === id);
  const to = from + direction;
  if (to < 0 || to >= sameGroup.length) return [...fields];
  const swapped = [...sameGroup];
  const [moved] = swapped.splice(from, 1);
  swapped.splice(to, 0, moved!);
  let next = 0;
  return fields.map((f) => (groupOf(f.kind) === group ? swapped[next++]! : f));
}

/** Adds an empty answer, up to the limit for the kind. */
export const addAnswer = (f: CampaignField): CampaignField =>
  f.options.length >= maxOptions(f.kind) ? f : { ...f, options: [...f.options, ''] };

/**
 * Removes an answer, keeping at least two. The correct mark follows its answer: removing the correct
 * one clears it, removing an earlier one moves it up.
 */
export function removeAnswer(f: CampaignField, index: number): CampaignField {
  if (f.options.length <= FIELD_LIMITS.optionsMin) return f;
  const c = f.correctIndex;
  const correctIndex = c === null ? null : c === index ? null : c > index ? c - 1 : c;
  return { ...f, options: f.options.filter((_, i) => i !== index), correctIndex };
}

export const setAnswer = (f: CampaignField, index: number, text: string): CampaignField => ({
  ...f,
  options: f.options.map((o, i) => (i === index ? text : o)),
});

export type FieldProblem = 'label' | 'answers' | 'empty' | 'different' | 'correct';

/** Whether a field is finished enough to launch, mirrored from the server so the form can say so early. */
export function fieldProblem(f: CampaignField): FieldProblem | null {
  if (f.label.trim() === '') return 'label';
  if (hasOptions(f.kind)) {
    const options = f.options.map((o) => o.trim());
    if (options.length < FIELD_LIMITS.optionsMin) return 'answers';
    if (options.some((o) => o === '')) return 'empty';
    const lower = options.map((o) => o.toLowerCase());
    if (new Set(lower).size !== lower.length) return 'different';
  }
  if (
    f.kind === 'quiz_question' &&
    (f.correctIndex === null || f.correctIndex >= f.options.length)
  ) {
    return 'correct';
  }
  return null;
}

/** The number field gives text; empty means no limit, anything else is a whole number in range. */
export function parseTimeLimit(text: string): number | null {
  const n = Math.floor(Number(text.trim()));
  if (text.trim() === '' || !Number.isFinite(n) || n < 1) return null;
  return Math.min(n, FIELD_LIMITS.timeLimitMax);
}

/** Attempts allowed, from what was typed or chosen: a whole number from 1 to the limit. */
export function parseMaxAttempts(text: string, fallback: number): number {
  const n = Math.floor(Number(text.trim()));
  if (text.trim() === '' || !Number.isFinite(n)) return fallback;
  return Math.min(FIELD_LIMITS.maxAttemptsMax, Math.max(1, n));
}

export function parsePassPercent(text: string, fallback: number): number {
  const n = Math.floor(Number(text.trim()));
  if (text.trim() === '' || !Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, n));
}
