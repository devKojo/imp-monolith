import { describe, expect, it } from 'vitest';
import type { FieldInput } from '../domain/fields';
import type { TemplateRef } from '../domain/model';
import { canManageCampaigns, canOperateCampaigns, canReadCampaigns } from '../domain/permissions';
import {
  defaultFields,
  effectiveStatus,
  failedChecks,
  fieldProblem,
  normalizeFields,
  normalizePrizes,
  normalizeSettings,
  preflight,
  runningStatusFor,
  slugify,
  templateProblem,
} from '../domain/rules';
import {
  detailsDraft,
  draftField,
  giveawayTemplate,
  quizQuestion,
  quizTemplate,
  surveyTemplate,
} from './fixtures';

const NOW = new Date('2026-11-14T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);
const template = (over: Partial<TemplateRef> = {}): TemplateRef => ({
  ...giveawayTemplate,
  ...over,
});
const fields = (): FieldInput[] => normalizeFields(detailsDraft());
const prize = { name: 'Grand prize', valueLabel: '1,000', winners: 1, description: '' };
const input = (over: Partial<Parameters<typeof preflight>[0]> = {}) => ({
  title: 'Launch',
  template: template(),
  startAt: null,
  endAt: hours(48),
  prizes: [prize],
  fields: fields(),
  ...over,
});

describe('effectiveStatus', () => {
  it('starts a scheduled campaign at its start time', () => {
    expect(effectiveStatus('SCHEDULED', hours(2), hours(48), NOW)).toBe('SCHEDULED');
    expect(effectiveStatus('SCHEDULED', hours(-1), hours(48), NOW)).toBe('LIVE');
    expect(effectiveStatus('SCHEDULED', hours(0), hours(48), NOW)).toBe('LIVE');
  });

  it('completes anything still running at its end time', () => {
    for (const s of ['SCHEDULED', 'LIVE', 'PAUSED'] as const) {
      expect(effectiveStatus(s, hours(-5), hours(-1), NOW)).toBe('COMPLETED');
    }
    expect(effectiveStatus('LIVE', null, hours(1), NOW)).toBe('LIVE');
  });

  it('leaves drafts, cancelled and completed campaigns as they are', () => {
    expect(effectiveStatus('DRAFT', null, hours(-1), NOW)).toBe('DRAFT');
    expect(effectiveStatus('CANCELLED', null, hours(-1), NOW)).toBe('CANCELLED');
    expect(effectiveStatus('COMPLETED', null, hours(-1), NOW)).toBe('COMPLETED');
    expect(effectiveStatus('PAUSED', null, hours(5), NOW)).toBe('PAUSED');
  });

  it('launches live now, or waits for a start in the future', () => {
    expect(runningStatusFor(null, NOW)).toBe('LIVE');
    expect(runningStatusFor(hours(-1), NOW)).toBe('LIVE');
    expect(runningStatusFor(hours(1), NOW)).toBe('SCHEDULED');
  });
});

describe('slugify', () => {
  it('makes lowercase ascii words joined by single hyphens', () => {
    expect(slugify('Win a Prize!')).toBe('win-a-prize');
    expect(slugify('  Café   Déjà-vu  ')).toBe('cafe-deja-vu');
    expect(slugify('Black Friday 2026')).toBe('black-friday-2026');
  });

  it('never returns an empty or over-long slug', () => {
    expect(slugify('!!!')).toBe('campaign');
    expect(slugify('日本語')).toBe('campaign');
    const long = slugify('word '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('preflight', () => {
  const passes = (over = {}, now = NOW) =>
    Object.fromEntries(preflight(input(over), now).map((c) => [c.id, c.pass]));

  it('passes a complete giveaway', () => {
    expect(failedChecks(input(), NOW)).toEqual([]);
  });

  it('needs a title and a template', () => {
    expect(passes({ title: '   ' }).title).toBe(false);
    expect(passes({ template: null }).template).toBe(false);
  });

  it('needs an end in the future, after any start', () => {
    expect(passes({ endAt: null }).schedule).toBe(false);
    expect(passes({ endAt: hours(-1) }).schedule).toBe(false);
    expect(passes({ startAt: hours(10), endAt: hours(5) }).schedule).toBe(false);
    expect(passes({ startAt: hours(1), endAt: hours(5) }).schedule).toBe(true);
  });

  it('requires prizes for giveaways and instant wins, but not for quizzes and surveys', () => {
    expect(passes({ prizes: [] }).prizes).toBe(false);
    expect(passes({ template: template({ archetype: 'instant' }), prizes: [] }).prizes).toBe(false);
    expect(passes({ template: quizTemplate, prizes: [] }).prizes).toBe(true);
    expect(passes({ template: surveyTemplate, prizes: [] }).prizes).toBe(true);
  });

  it('rejects an unfinished prize whatever the template', () => {
    const quiz = quizTemplate;
    expect(passes({ template: quiz, prizes: [{ ...prize, name: ' ' }] }).prizes).toBe(false);
    expect(passes({ template: quiz, prizes: [{ ...prize, winners: 0 }] }).prizes).toBe(false);
  });
});

describe('preflight: details and content', () => {
  const passes = (over = {}) =>
    Object.fromEntries(preflight(input(over), NOW).map((c) => [c.id, c.pass]));
  const withQuestion = (q = quizQuestion()) => [...fields(), ...normalizeFields([q])];

  it('needs a way to reach the participant and a required consent', () => {
    expect(passes().details).toBe(true);
    expect(passes({ fields: [] }).details).toBe(false);
    expect(passes({ fields: fields().filter((f) => f.kind !== 'consent') }).details).toBe(false);
    expect(passes({ fields: fields().filter((f) => f.kind !== 'email') }).details).toBe(false);
    const optionalConsent = fields().map((f) =>
      f.kind === 'consent' ? { ...f, required: false } : f,
    );
    expect(passes({ fields: optionalConsent }).details).toBe(false);
    const phoneOnly = normalizeFields([
      draftField('phone', { label: 'Phone', required: true }),
      draftField('consent', { label: 'I agree', required: true }),
    ]);
    expect(passes({ fields: phoneOnly }).details).toBe(true);
  });

  it('needs the minimum number of complete questions that the template asks for', () => {
    expect(passes({ template: quizTemplate, prizes: [] }).content).toBe(false);
    expect(passes({ template: quizTemplate, prizes: [], fields: withQuestion() }).content).toBe(
      true,
    );
    expect(passes().content).toBe(true); // a giveaway needs no questions
  });

  it('rejects any unfinished field', () => {
    const quiz = { template: quizTemplate, prizes: [] };
    for (const q of [
      quizQuestion({ label: '' }),
      quizQuestion({ correctIndex: null }),
      quizQuestion({ options: ['Only'], correctIndex: 0 }),
      quizQuestion({ options: ['A', ''], correctIndex: 0 }),
      quizQuestion({ options: ['A', 'a'], correctIndex: 0 }),
    ]) {
      expect(passes({ ...quiz, fields: withQuestion(q) }).content).toBe(false);
    }
    const blankLabel = [...fields(), ...normalizeFields([draftField('phone', { label: ' ' })])];
    expect(passes({ fields: blankLabel }).content).toBe(false);
  });
});

describe('fields', () => {
  it('names each field by its kind, with a number after the first', () => {
    const keys = normalizeFields([
      draftField('email'),
      draftField('choice'),
      draftField('choice'),
      draftField('long_text'),
      draftField('choice'),
    ]).map((f) => f.key);
    expect(keys).toEqual(['email', 'question', 'question_2', 'long_answer', 'question_3']);
  });

  it('keeps options only for choices and a correct answer only for a quiz question', () => {
    const [email, choice, quiz] = normalizeFields([
      draftField('email', { options: ['x'], correctIndex: 0 }),
      draftField('choice', { options: [' A ', 'B'], correctIndex: 1 }),
      quizQuestion({ options: ['A', 'B'], correctIndex: 1, required: false }),
    ]);
    expect(email).toMatchObject({ options: [], correctIndex: null });
    expect(choice).toMatchObject({ options: ['A', 'B'], correctIndex: null });
    expect(quiz).toMatchObject({ correctIndex: 1, required: true });
  });

  it('drops a correct mark that points past the answers', () => {
    const [q] = normalizeFields([quizQuestion({ options: ['A', 'B'], correctIndex: 4 })]);
    expect(q!.correctIndex).toBeNull();
  });

  it('starts a campaign with the details its type begins with', () => {
    expect(defaultFields(giveawayTemplate).map((f) => [f.kind, f.required])).toEqual([
      ['email', true],
      ['consent', true],
    ]);
    expect(defaultFields(quizTemplate).every((f) => f.kind !== 'quiz_question')).toBe(true);
  });

  it('only keeps settings for a quiz', () => {
    expect(
      normalizeSettings(giveawayTemplate, { timeLimitMinutes: 5, passPercent: 50, maxAttempts: 1 }),
    ).toEqual({});
    expect(normalizeSettings(null, null)).toEqual({});
    expect(normalizeSettings(quizTemplate, null)).toEqual({
      quiz: { timeLimitMinutes: null, passPercent: 70, maxAttempts: 1 },
    });
    expect(
      normalizeSettings(quizTemplate, { timeLimitMinutes: 5, passPercent: 50, maxAttempts: 1 }),
    ).toEqual({
      quiz: { timeLimitMinutes: 5, passPercent: 50, maxAttempts: 1 },
    });
  });

  it('refuses kinds the type does not allow, too many of one kind, and fields with no type', () => {
    const f = (...kinds: Parameters<typeof draftField>[0][]) =>
      normalizeFields(kinds.map((k) => draftField(k)));
    expect(templateProblem(f('email', 'consent'), giveawayTemplate)).toBeNull();
    expect(templateProblem(f('quiz_question'), giveawayTemplate)).toMatch(/cannot have/);
    expect(templateProblem(f('email', 'email'), giveawayTemplate)).toMatch(/at most 1/);
    expect(templateProblem(f('email'), null)).toMatch(/Choose a campaign type/);
    expect(templateProblem([], null)).toBeNull();
    expect(templateProblem(f('choice', 'choice', 'choice'), surveyTemplate)).toBeNull();
  });

  it('limits the number of questions, and the answers of a quiz question', () => {
    const many = normalizeFields(Array.from({ length: 51 }, () => quizQuestion()));
    expect(templateProblem(many, quizTemplate)).toMatch(/at most 50/);
    const wide = normalizeFields([
      quizQuestion({ options: ['1', '2', '3', '4', '5', '6', '7'], correctIndex: 0 }),
    ]);
    expect(templateProblem(wide, quizTemplate)).toMatch(/at most 6 answers/);
  });

  it('says what is unfinished about a field', () => {
    const one = (f: ReturnType<typeof draftField>) => fieldProblem(normalizeFields([f])[0]!);
    expect(one(draftField('email', { label: 'Email' }))).toBeNull();
    expect(one(draftField('email', { label: '' }))).toBe('label');
    expect(one(draftField('choice', { label: 'Q', options: ['A'] }))).toBe('answers');
    expect(one(draftField('choice', { label: 'Q', options: ['A', ''] }))).toBe('empty');
    expect(one(draftField('choice', { label: 'Q', options: ['A', 'A'] }))).toBe('different');
    expect(one(draftField('choice', { label: 'Q', options: ['A', 'B'] }))).toBeNull();
    expect(one(quizQuestion({ correctIndex: null }))).toBe('correct');
  });
});

describe('normalizePrizes', () => {
  it('trims text and keeps the winner count', () => {
    expect(
      normalizePrizes([{ name: ' A ', valueLabel: ' 5 ', winners: 3, description: ' x ' }]),
    ).toEqual([{ name: 'A', valueLabel: '5', winners: 3, description: 'x' }]);
  });
});

describe('permissions', () => {
  it('lets everyone read, operators pause and resume, and only managers change', () => {
    for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']) {
      expect([canReadCampaigns(role), canOperateCampaigns(role), canManageCampaigns(role)]).toEqual(
        [true, true, true],
      );
    }
    expect([
      canReadCampaigns('CAMPAIGN_OPERATOR'),
      canOperateCampaigns('CAMPAIGN_OPERATOR'),
      canManageCampaigns('CAMPAIGN_OPERATOR'),
    ]).toEqual([true, true, false]);
    for (const role of ['ANALYST', 'MODERATOR']) {
      expect([canReadCampaigns(role), canOperateCampaigns(role), canManageCampaigns(role)]).toEqual(
        [true, false, false],
      );
    }
    expect(canReadCampaigns('PARTICIPANT')).toBe(false);
  });
});
