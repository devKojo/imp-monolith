import {
  FIELD_LIMITS,
  groupOf,
  hasOptions,
  type FieldDraft,
  type FieldInput,
  type FieldKind,
  type QuizSettings,
} from './fields';
import type {
  CampaignStatus,
  PreflightCheck,
  PrizeInput,
  StoredCampaign,
  TemplateRef,
} from './model';

/** Pure rules for campaigns: no I/O, no clock of their own, fully unit-tested. */

/**
 * The status people should see. The stored status is what was last written; the schedule moves a
 * campaign on its own: a scheduled campaign becomes live at its start, and anything not closed by a
 * person completes at its end. Computing this on read means no background job has to keep it true.
 */
export function effectiveStatus(
  stored: CampaignStatus,
  startAt: Date | null,
  endAt: Date | null,
  now: Date,
): CampaignStatus {
  const running = stored === 'SCHEDULED' || stored === 'LIVE' || stored === 'PAUSED';
  if (running && endAt && now >= endAt) return 'COMPLETED';
  if (stored === 'SCHEDULED' && startAt && now >= startAt) return 'LIVE';
  return stored;
}

export const withEffectiveStatus = <T extends Pick<StoredCampaign, 'status' | 'startAt' | 'endAt'>>(
  row: T,
  now: Date,
): T => ({
  ...row,
  status: effectiveStatus(
    row.status,
    row.startAt ? new Date(row.startAt) : null,
    row.endAt ? new Date(row.endAt) : null,
    now,
  ),
});

/** Launching (or resuming) before the start time waits for it; otherwise the campaign is live now. */
export const runningStatusFor = (startAt: Date | null, now: Date): 'SCHEDULED' | 'LIVE' =>
  startAt && startAt > now ? 'SCHEDULED' : 'LIVE';

/** `Win a Prize!` becomes `win-a-prize`: lowercase ASCII words joined by single hyphens. */
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return base || 'campaign';
}

/** Trim what the client sent so equal input is stored the same way. */
export const normalizePrizes = (prizes: readonly PrizeInput[]): PrizeInput[] =>
  prizes.map((p) => ({
    name: p.name.trim(),
    valueLabel: p.valueLabel.trim(),
    winners: p.winners,
    description: p.description.trim(),
  }));

export type PreflightInput = {
  title: string;
  template: TemplateRef | null;
  startAt: Date | null;
  endAt: Date | null;
  prizes: readonly PrizeInput[];
  fields: readonly FieldInput[];
};

/**
 * The checks a campaign must pass to launch. The server is the authority: the web app shows the same
 * list to guide people, but only this result decides.
 */
export function preflight(input: PreflightInput, now: Date): PreflightCheck[] {
  const prizesComplete = input.prizes.every((p) => p.name.trim() !== '' && p.winners >= 1);
  const needsPrizes = input.template?.requiresPrizes ?? false;
  const contact = input.fields.some((f) => f.kind === 'email' || f.kind === 'phone');
  const consent = input.fields.some((f) => f.kind === 'consent' && f.required);
  const content = input.fields.filter((f) => groupOf(f.kind) === 'content');
  return [
    { id: 'title', pass: input.title.trim() !== '' },
    { id: 'template', pass: input.template !== null },
    {
      id: 'schedule',
      pass:
        input.endAt !== null &&
        input.endAt > now &&
        (input.startAt === null || input.startAt < input.endAt),
    },
    { id: 'prizes', pass: prizesComplete && (!needsPrizes || input.prizes.length > 0) },
    // Someone must be reachable, and agree to the rules.
    { id: 'details', pass: contact && consent },
    {
      id: 'content',
      pass:
        content.length >= (input.template?.minContentFields ?? 0) &&
        input.fields.every((f) => fieldProblem(f) === null),
    },
  ];
}

export const failedChecks = (input: PreflightInput, now: Date): PreflightCheck[] =>
  preflight(input, now).filter((c) => !c.pass);

// ---- fields ------------------------------------------------------------------------------

/** The machine name a kind starts from; later ones of the same kind get `_2`, `_3`... */
const KEY_BASE: Record<FieldKind, string> = {
  full_name: 'full_name',
  email: 'email',
  phone: 'phone',
  address: 'delivery_address',
  wallet: 'wallet_address',
  choice: 'question',
  likert: 'rating',
  upload: 'document',
  text: 'answer',
  long_text: 'long_answer',
  consent: 'consent',
  quiz_question: 'quiz_question',
};

/**
 * Tidies what the client sent so equal input is stored the same way, and gives each field its machine
 * name. Only a choice or quiz question keeps options, and only a quiz question keeps a correct answer
 * (a quiz question is always required: it counts toward the score).
 */
export function normalizeFields(fields: readonly FieldDraft[]): FieldInput[] {
  const used = new Set<string>();
  return fields.map((f) => {
    const base = KEY_BASE[f.kind];
    let key = base;
    for (let n = 2; used.has(key); n += 1) key = `${base}_${n}`;
    used.add(key);
    const options = hasOptions(f.kind) ? f.options.map((o) => o.trim()) : [];
    const correct =
      f.kind === 'quiz_question' && f.correctIndex !== null && f.correctIndex < options.length
        ? f.correctIndex
        : null;
    return {
      kind: f.kind,
      key,
      label: f.label.trim(),
      helper: f.helper.trim(),
      required: f.kind === 'quiz_question' ? true : f.required,
      options,
      correctIndex: correct,
    };
  });
}

/** What a new campaign of a type starts with: the fields its template says to begin with. */
export function defaultFields(template: TemplateRef): FieldDraft[] {
  return template.fields.flatMap((a) =>
    Array.from({ length: a.defaultCount }, (): FieldDraft => ({
      kind: a.kind,
      label: a.defaultLabel,
      helper: '',
      required: a.defaultRequired,
      options: hasOptions(a.kind) ? ['', ''] : [],
      correctIndex: null,
    })),
  );
}

/** Settings only exist for the type that uses them; anything else is dropped. */
export function normalizeSettings(
  template: TemplateRef | null,
  quiz: QuizSettings | null | undefined,
) {
  return template?.archetype === 'quiz'
    ? {
        quiz: quiz ?? {
          timeLimitMinutes: null,
          passPercent: FIELD_LIMITS.defaultPassPercent,
          maxAttempts: FIELD_LIMITS.defaultMaxAttempts,
        },
      }
    : {};
}

/**
 * Why these fields do not fit the template, or null. A draft may be incomplete, but it may only contain
 * kinds its template allows, no more of a kind than allowed, and quiz questions within what a quiz can show.
 */
export function templateProblem(
  fields: readonly FieldInput[],
  template: TemplateRef | null,
): string | null {
  if (fields.length > FIELD_LIMITS.fieldsMax) return 'Too many fields';
  if (fields.filter((f) => groupOf(f.kind) === 'content').length > FIELD_LIMITS.contentMax) {
    return `A campaign can have at most ${FIELD_LIMITS.contentMax} questions`;
  }
  if (!template) return fields.length > 0 ? 'Choose a campaign type before adding fields' : null;
  const allowed = new Map(template.fields.map((a) => [a.kind, a]));
  const counts = new Map<FieldKind, number>();
  for (const f of fields) {
    const rule = allowed.get(f.kind);
    if (!rule)
      return `A ${template.name.toLowerCase()} cannot have a ${f.kind.replace('_', ' ')} field`;
    const n = (counts.get(f.kind) ?? 0) + 1;
    counts.set(f.kind, n);
    if (rule.maxCount !== null && n > rule.maxCount) {
      return `A ${template.name.toLowerCase()} can have at most ${rule.maxCount} ${f.kind.replace('_', ' ')} field${rule.maxCount === 1 ? '' : 's'}`;
    }
    const labelMax = groupOf(f.kind) === 'content' ? FIELD_LIMITS.promptMax : FIELD_LIMITS.labelMax;
    if (f.label.length > labelMax) return 'A field label is too long';
    if (f.kind === 'quiz_question' && f.options.length > FIELD_LIMITS.quizOptionsMax) {
      return `A quiz question can have at most ${FIELD_LIMITS.quizOptionsMax} answers`;
    }
  }
  return null;
}

/**
 * Whether a field is complete enough to show participants, or why not. Drafts may hold unfinished
 * fields; launching needs every one of them finished.
 */
export function fieldProblem(f: FieldInput): string | null {
  if (f.label.trim() === '') return 'label';
  if (hasOptions(f.kind)) {
    if (f.options.length < FIELD_LIMITS.optionsMin) return 'answers';
    if (f.options.some((o) => o.trim() === '')) return 'empty';
    const lower = f.options.map((o) => o.trim().toLowerCase());
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
