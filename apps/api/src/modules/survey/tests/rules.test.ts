import { describe, expect, it } from 'vitest';
import { estimatedMinutes, missingRequired, normalizeAnswer } from '../domain/rules';

const choice = { kind: 'choice' as const, options: ['Yes', 'No', 'Maybe'] };
const likert = { kind: 'likert' as const, options: [] };
const text = { kind: 'text' as const, options: [] };
const long = { kind: 'long_text' as const, options: [] };

describe('normalizeAnswer', () => {
  it('accepts an option that exists, and nothing past the last one', () => {
    expect(normalizeAnswer(choice, { choiceIndex: 2 })).toEqual({ choiceIndex: 2 });
    expect(normalizeAnswer(choice, { choiceIndex: 3 })).toBeNull();
    expect(normalizeAnswer(choice, { choiceIndex: -1 })).toBeNull();
    expect(normalizeAnswer(choice, { choiceIndex: 1.5 })).toBeNull();
  });

  it('treats a rating as five points, 0 to 4', () => {
    expect(normalizeAnswer(likert, { choiceIndex: 0 })).toEqual({ choiceIndex: 0 });
    expect(normalizeAnswer(likert, { choiceIndex: 4 })).toEqual({ choiceIndex: 4 });
    expect(normalizeAnswer(likert, { choiceIndex: 5 })).toBeNull();
  });

  it('trims written text and clears when it is empty', () => {
    expect(normalizeAnswer(text, { text: '  hello  ' })).toEqual({ text: 'hello' });
    expect(normalizeAnswer(text, { text: '   ' })).toBe('clear');
  });

  it('limits written text by kind', () => {
    expect(normalizeAnswer(text, { text: 'a'.repeat(500) })).not.toBeNull();
    expect(normalizeAnswer(text, { text: 'a'.repeat(501) })).toBeNull();
    expect(normalizeAnswer(long, { text: 'a'.repeat(4000) })).not.toBeNull();
    expect(normalizeAnswer(long, { text: 'a'.repeat(4001) })).toBeNull();
  });

  it('rejects an answer of the wrong shape for the question', () => {
    expect(normalizeAnswer(choice, { text: 'Yes' })).toBeNull();
    expect(normalizeAnswer(text, { choiceIndex: 0 })).toBeNull();
    expect(normalizeAnswer(choice, {})).toBeNull();
    expect(normalizeAnswer(text, {})).toBeNull();
  });
});

describe('missingRequired', () => {
  const qs = [
    { id: 'a', required: true },
    { id: 'b', required: false },
    { id: 'c', required: true },
  ];
  it('lists unanswered required questions in order, ignoring optional ones', () => {
    expect(missingRequired(qs, { c: { text: 'x' } })).toEqual(['a']);
    expect(missingRequired(qs, {})).toEqual(['a', 'c']);
    expect(missingRequired(qs, { a: { choiceIndex: 0 }, c: { choiceIndex: 1 } })).toEqual([]);
  });
});

describe('estimatedMinutes', () => {
  it('is never less than one minute', () => {
    expect(estimatedMinutes([])).toBe(1);
    expect(estimatedMinutes([{ kind: 'choice' }])).toBe(1);
  });
  it('rounds up from the time each kind of question takes', () => {
    // 4 x 15s + 2 x 45s + 1 x 90s = 240s
    const qs = [
      ...Array.from({ length: 4 }, () => ({ kind: 'likert' as const })),
      { kind: 'text' as const },
      { kind: 'text' as const },
      { kind: 'long_text' as const },
    ];
    expect(estimatedMinutes(qs)).toBe(4);
    expect(estimatedMinutes([...qs, { kind: 'choice' as const }])).toBe(5);
  });
});
