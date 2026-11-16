import { groupOf, hasOptions, type FieldDraft, type FieldKind } from '../domain/fields';
import type { AllowedField, TemplateRef } from '../domain/model';

/** The ids the migration seeds, so tests against real PostgreSQL use the real built-in types. */
export const SEEDED = {
  quiz: '01a1e000-0000-7000-8000-000000000001',
  survey: '01a1e000-0000-7000-8000-000000000002',
  giveaway: '01a1e000-0000-7000-8000-000000000003',
  instant: '01a1e000-0000-7000-8000-000000000004',
} as const;

const allow = (
  kind: FieldKind,
  maxCount: number | null,
  defaultCount: number,
  defaultLabel: string,
  defaultRequired: boolean,
): AllowedField => ({
  kind,
  group: groupOf(kind),
  maxCount,
  defaultCount,
  defaultLabel,
  defaultRequired,
});

const details = [
  allow('email', 1, 1, 'Email address', true),
  allow('phone', 1, 0, 'Mobile number', false),
  allow('full_name', 1, 0, 'Full name', false),
];

/** The built-in types as the migration seeds them (kept in step by the database tests). */
export const quizTemplate: TemplateRef = {
  id: SEEDED.quiz,
  slug: 'quiz',
  name: 'Quiz',
  archetype: 'quiz',
  description: '',
  minContentFields: 1,
  requiresPrizes: false,
  fields: [
    ...details,
    allow('consent', 1, 1, 'I agree to the rules and the privacy notice', true),
    allow('quiz_question', 50, 0, 'Question', true),
  ],
};

export const surveyTemplate: TemplateRef = {
  id: SEEDED.survey,
  slug: 'survey',
  name: 'Survey',
  archetype: 'survey',
  description: '',
  minContentFields: 1,
  requiresPrizes: false,
  fields: [
    ...details,
    allow('consent', 1, 1, 'I agree to the privacy notice', true),
    allow('choice', 50, 0, 'Question', false),
    allow('likert', 50, 0, 'Rate from 1 to 5', false),
    allow('text', 50, 0, 'Short answer', false),
    allow('long_text', 50, 0, 'Long answer', false),
  ],
};

export const giveawayTemplate: TemplateRef = {
  id: SEEDED.giveaway,
  slug: 'giveaway',
  name: 'Giveaway',
  archetype: 'giveaway',
  description: '',
  minContentFields: 0,
  requiresPrizes: true,
  fields: [
    ...details,
    allow('address', 1, 0, 'Delivery address', false),
    allow('wallet', 1, 0, 'Wallet address', false),
    allow('consent', 1, 1, 'I agree to the rules and the privacy notice', true),
  ],
};

export const draftField = (kind: FieldKind, over: Partial<FieldDraft> = {}): FieldDraft => ({
  kind,
  label: kind,
  helper: '',
  required: false,
  options: hasOptions(kind) ? ['A', 'B'] : [],
  correctIndex: null,
  ...over,
});

/** The participant details a campaign needs to launch: a way to reach them, and their consent. */
export const detailsDraft = (): FieldDraft[] => [
  draftField('email', { label: 'Email address', required: true }),
  draftField('consent', { label: 'I agree', required: true }),
];

export const quizQuestion = (over: Partial<FieldDraft> = {}): FieldDraft =>
  draftField('quiz_question', {
    label: 'Capital of Ghana?',
    options: ['Accra', 'Kumasi', 'Tamale'],
    correctIndex: 0,
    required: true,
    ...over,
  });

export const quizSettings = {
  quiz: { timeLimitMinutes: null, passPercent: 70, maxAttempts: 1 },
};
