import { FIELD_KINDS, LIMITS, type FieldInput, type PreflightCheck } from './model';

/** Pure rules for templates: no I/O, no framework, fully unit-tested. */

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** Kinds that prove who the participant is, so entries can be verified and drawn fairly. */
const IDENTITY_KINDS = new Set<string>(['email', 'phone']);

/**
 * Clean what the client sent so equal input is stored the same way: trimmed text, answers only on a
 * choice question. Blank labels and answers are kept (a draft may be unfinished); the pre-flight
 * check is what stops them reaching publication.
 */
export function normalizeFields(fields: readonly FieldInput[]): FieldInput[] {
  return fields.map((f) => ({
    kind: f.kind,
    key: f.key.trim(),
    label: f.label.trim(),
    helper: f.helper.trim(),
    required: f.required,
    options: f.kind === 'choice' ? f.options.map((o) => o.trim()) : [],
  }));
}

/** Keys that appear more than once, so the caller can name them in the error. */
export function duplicateKeys(fields: readonly FieldInput[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.key)) dupes.add(f.key);
    seen.add(f.key);
  }
  return [...dupes];
}

/**
 * The checks a template must pass to be published. The server is the authority: the web app shows
 * the same list to guide people, but only this result decides.
 */
export function preflight(fields: readonly FieldInput[]): PreflightCheck[] {
  const filledOptions = (f: FieldInput) => f.options.filter((o) => o.trim() !== '').length;
  return [
    { id: 'fields', pass: fields.length > 0 },
    { id: 'identity', pass: fields.some((f) => IDENTITY_KINDS.has(f.kind)) },
    { id: 'consent', pass: fields.some((f) => f.kind === 'consent' && f.required) },
    {
      id: 'labels',
      pass:
        fields.length > 0 &&
        fields.every(
          (f) =>
            f.label.trim() !== '' &&
            (f.kind !== 'choice' || filledOptions(f) >= LIMITS.optionsMinToPublish),
        ),
    },
  ];
}

export const failedChecks = (fields: readonly FieldInput[]): PreflightCheck[] =>
  preflight(fields).filter((c) => !c.pass);

export const isKnownKind = (kind: string): boolean =>
  (FIELD_KINDS as readonly string[]).includes(kind);
