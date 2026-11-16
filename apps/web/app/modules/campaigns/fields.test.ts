// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  FIELD_LIMITS,
  addAnswer,
  addField,
  addable,
  defaultSettingsFor,
  fieldProblem,
  fieldsOf,
  fitToTemplate,
  groupOf,
  moveField,
  newField,
  parsePassPercent,
  parseMaxAttempts,
  parseTimeLimit,
  quizSettingsOf,
  removeAnswer,
  removeField,
  setAnswer,
  startingFields,
  updateField,
} from './fields';
import type { AllowedField, CampaignField, FieldKind, TemplateRef } from './types';

const allow = (
  kind: FieldKind,
  maxCount: number | null,
  defaultCount: number,
  defaultLabel = kind,
  defaultRequired = false,
): AllowedField => ({
  kind,
  group: groupOf(kind),
  maxCount,
  defaultCount,
  defaultLabel,
  defaultRequired,
});

const quiz: TemplateRef = {
  id: 'q',
  slug: 'quiz',
  name: 'Quiz',
  archetype: 'quiz',
  description: '',
  minContentFields: 1,
  requiresPrizes: false,
  fields: [
    allow('email', 1, 1, 'Email address', true),
    allow('phone', 1, 0, 'Mobile number'),
    allow('consent', 1, 1, 'I agree', true),
    allow('quiz_question', 50, 0, 'Question', true),
  ],
};
const survey: TemplateRef = {
  ...quiz,
  id: 's',
  slug: 'survey',
  archetype: 'survey',
  fields: [
    allow('email', 1, 1, 'Email address', true),
    allow('consent', 1, 1, 'I agree', true),
    allow('choice', null, 0, 'Question'),
    allow('text', null, 0, 'Short answer'),
  ],
};

let n = 0;
const uid = () => `id${(n += 1)}`;
const make = (kind: FieldKind, over: Partial<CampaignField> = {}): CampaignField => ({
  ...newField(kind, quiz, uid()),
  ...over,
});

describe('starting a campaign', () => {
  it('begins with what the type says, labelled and required as the template says', () => {
    const fields = startingFields(quiz, uid);
    expect(fields.map((f) => [f.kind, f.label, f.required])).toEqual([
      ['email', 'Email address', true],
      ['consent', 'I agree', true],
    ]);
  });

  it('starts a choice or quiz question with two empty answers and no correct mark', () => {
    expect(newField('quiz_question', quiz, 'x')).toMatchObject({
      options: ['', ''],
      correctIndex: null,
      required: true,
    });
    expect(newField('text', survey, 'x')).toMatchObject({ options: [], required: false });
  });

  it('only offers kinds the type allows and has room for', () => {
    const fields = startingFields(quiz, uid);
    expect(addable(quiz, fields, 'details').map((a) => a.kind)).toEqual(['phone']);
    expect(addable(quiz, fields, 'content').map((a) => a.kind)).toEqual(['quiz_question']);
    expect(addable(null, fields, 'details')).toEqual([]);
    const full = Array.from({ length: FIELD_LIMITS.content }, () => make('quiz_question'));
    expect(addable(quiz, full, 'content')).toEqual([]);
  });

  it('keeps what a new type allows when the type changes, or starts over if nothing fits', () => {
    const mixed = [...startingFields(quiz, uid), make('quiz_question', { label: 'Q' })];
    const kept = fitToTemplate(mixed, survey, uid);
    expect(kept.map((f) => f.kind)).toEqual(['email', 'consent']);
    expect(fitToTemplate([make('quiz_question')], survey, uid).map((f) => f.kind)).toEqual([
      'email',
      'consent',
    ]);
    const twoEmails = [make('email'), make('email')];
    expect(fitToTemplate(twoEmails, quiz, uid)).toHaveLength(1);
  });

  it('has quiz settings only for a quiz', () => {
    expect(defaultSettingsFor(quiz)).toEqual({
      quiz: { timeLimitMinutes: null, passPercent: 70, maxAttempts: 1 },
    });
    expect(defaultSettingsFor(survey)).toEqual({});
    expect(defaultSettingsFor(null)).toEqual({});
    expect(quizSettingsOf({})).toEqual({ timeLimitMinutes: null, passPercent: 70, maxAttempts: 1 });
    // An older campaign that has no attempts setting gets one attempt.
    expect(
      quizSettingsOf({ quiz: { timeLimitMinutes: 5, passPercent: 60 } as never }),
    ).toMatchObject({
      maxAttempts: 1,
      passPercent: 60,
    });
  });
});

describe('editing fields', () => {
  it('adds, updates and removes without touching the input', () => {
    const all = [make('email'), make('consent')];
    const before = JSON.stringify(all);
    const extra = make('phone');
    expect(addField(all, extra)).toHaveLength(3);
    expect(updateField(all, all[0]!.id, { label: 'New' })[0]!.label).toBe('New');
    expect(removeField(all, all[0]!.id).map((f) => f.kind)).toEqual(['consent']);
    expect(JSON.stringify(all)).toBe(before);
  });

  it('moves a field within its own group, leaving the other group in place', () => {
    const [email, consent] = [make('email'), make('consent')];
    const [q1, q2, q3] = [make('quiz_question'), make('quiz_question'), make('quiz_question')];
    const all = [email, q1, consent, q2, q3];
    const ids = (fs: CampaignField[]) => fs.map((f) => f.id);
    expect(ids(moveField(all, q2.id, -1))).toEqual(ids([email, q2, consent, q1, q3]));
    expect(ids(moveField(all, q1.id, -1))).toEqual(ids(all)); // already first question
    expect(ids(moveField(all, q3.id, 1))).toEqual(ids(all)); // already last question
    expect(ids(moveField(all, consent.id, -1))).toEqual(ids([consent, q1, email, q2, q3]));
    expect(fieldsOf(all, 'content')).toHaveLength(3);
  });

  it('adds answers up to the limit for the kind', () => {
    let q = make('quiz_question');
    for (let i = 0; i < 10; i++) q = addAnswer(q);
    expect(q.options).toHaveLength(FIELD_LIMITS.quizOptionsMax);
    let c = make('choice', { options: ['A', 'B'] });
    for (let i = 0; i < 30; i++) c = addAnswer(c);
    expect(c.options).toHaveLength(FIELD_LIMITS.optionsMax);
  });

  it('removes answers down to two, and the correct mark follows its answer', () => {
    const q = make('quiz_question', { options: ['a', 'b', 'c', 'd'], correctIndex: 2 });
    expect(removeAnswer(q, 0)).toMatchObject({ options: ['b', 'c', 'd'], correctIndex: 1 });
    expect(removeAnswer(q, 3)).toMatchObject({ options: ['a', 'b', 'c'], correctIndex: 2 });
    expect(removeAnswer(q, 2)).toMatchObject({ options: ['a', 'b', 'd'], correctIndex: null });
    expect(removeAnswer(make('quiz_question', { options: ['a', 'b'] }), 0).options).toEqual([
      'a',
      'b',
    ]);
    expect(removeAnswer(make('choice', { options: ['a', 'b', 'c'] }), 1).correctIndex).toBeNull();
  });

  it('edits one answer', () => {
    expect(setAnswer(make('choice', { options: ['a', 'b'] }), 1, 'z').options).toEqual(['a', 'z']);
  });

  it('says what is unfinished about a field, as the server will', () => {
    const one = (f: CampaignField) => fieldProblem(f);
    expect(one(make('email', { label: 'Email' }))).toBeNull();
    expect(one(make('email', { label: ' ' }))).toBe('label');
    expect(one(make('choice', { label: 'Q', options: ['A'] }))).toBe('answers');
    expect(one(make('choice', { label: 'Q', options: ['A', ''] }))).toBe('empty');
    expect(one(make('choice', { label: 'Q', options: ['A', ' a'] }))).toBe('different');
    expect(one(make('choice', { label: 'Q', options: ['A', 'B'] }))).toBeNull();
    expect(one(make('quiz_question', { label: 'Q', options: ['A', 'B'] }))).toBe('correct');
    expect(
      one(make('quiz_question', { label: 'Q', options: ['A', 'B'], correctIndex: 1 })),
    ).toBeNull();
  });
});

describe('the number fields', () => {
  it('reads empty as no limit, and keeps values in range', () => {
    expect(parseTimeLimit('')).toBeNull();
    expect(parseTimeLimit('0')).toBeNull();
    expect(parseTimeLimit('15')).toBe(15);
    expect(parseTimeLimit('999')).toBe(FIELD_LIMITS.timeLimitMax);
    expect(parsePassPercent('', 70)).toBe(70);
    expect(parsePassPercent('0', 70)).toBe(1);
    expect(parsePassPercent('150', 70)).toBe(100);
    expect(parsePassPercent('85', 70)).toBe(85);
  });
});

describe('parseMaxAttempts', () => {
  it('is a whole number from 1 to the limit, keeping the old value for text that is not a number', () => {
    expect(parseMaxAttempts('3', 1)).toBe(3);
    expect(parseMaxAttempts('0', 1)).toBe(1);
    expect(parseMaxAttempts('99', 1)).toBe(5);
    expect(parseMaxAttempts('2.9', 1)).toBe(2);
    expect(parseMaxAttempts('', 4)).toBe(4);
    expect(parseMaxAttempts('abc', 4)).toBe(4);
  });
});
