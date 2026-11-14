// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createBlock,
  currentStage,
  duplicateBlock,
  isPublishable,
  moveBlock,
  preflight,
  removeBlock,
  stageStatuses,
  uniqueKey,
  updateBlock,
} from './logic';
import type { BlockKind, TemplateBlock } from './types';

let n = 0;
const block = (kind: BlockKind, blocks: TemplateBlock[] = [], label: string = kind) =>
  createBlock(kind, label, `b${(n += 1)}`, blocks);
const build = (...kinds: BlockKind[]) =>
  kinds.reduce<TemplateBlock[]>((all, kind) => [...all, block(kind, all)], []);

describe('keys', () => {
  it('keeps machine names unique', () => {
    const blocks = build('email', 'email', 'email');
    expect(blocks.map((b) => b.key)).toEqual(['email', 'email_2', 'email_3']);
    expect(uniqueKey('phone', blocks)).toBe('phone');
  });
});

describe('editing the pipeline', () => {
  it('moves a block and stops at the ends', () => {
    const all = build('full_name', 'email', 'consent');
    const [a, b, c] = all as [TemplateBlock, TemplateBlock, TemplateBlock];
    expect(moveBlock(all, b.id, -1).map((x) => x.id)).toEqual([b.id, a.id, c.id]);
    expect(moveBlock(all, a.id, -1).map((x) => x.id)).toEqual([a.id, b.id, c.id]);
    expect(moveBlock(all, c.id, 1).map((x) => x.id)).toEqual([a.id, b.id, c.id]);
  });

  it('does not mutate its input', () => {
    const all = build('full_name', 'email');
    const before = JSON.stringify(all);
    moveBlock(all, all[0]!.id, 1);
    removeBlock(all, all[0]!.id);
    updateBlock(all, all[0]!.id, { label: 'Changed' });
    expect(JSON.stringify(all)).toBe(before);
  });

  it('duplicates right after the original with its own id and a unique key', () => {
    const all = build('email', 'consent');
    const out = duplicateBlock(all, all[0]!.id, 'copy-1');
    expect(out.map((b) => b.id)).toEqual([all[0]!.id, 'copy-1', all[1]!.id]);
    expect(out[1]!.key).toBe('email_2');
    expect(out[1]!.label).toBe(all[0]!.label);
  });

  it('removes and updates by id', () => {
    const all = build('email', 'phone');
    expect(removeBlock(all, all[0]!.id)).toHaveLength(1);
    expect(updateBlock(all, all[1]!.id, { required: false })[1]!.required).toBe(false);
  });
});

describe('pre-flight checks', () => {
  const pass = (blocks: TemplateBlock[]) =>
    Object.fromEntries(preflight(blocks).map((c) => [c.id, c.pass]));

  it('fails an empty template on every check', () => {
    expect(pass([])).toEqual({ fields: false, identity: false, consent: false, labels: false });
    expect(isPublishable([])).toBe(false);
  });

  it('needs a verifiable identity field and a required consent', () => {
    expect(pass(build('full_name', 'consent'))).toMatchObject({ identity: false, consent: true });
    expect(pass(build('email'))).toMatchObject({ identity: true, consent: false });
    expect(isPublishable(build('email', 'consent'))).toBe(true);
  });

  it('does not accept an optional consent', () => {
    const all = build('email', 'consent');
    const optional = updateBlock(all, all[1]!.id, { required: false });
    expect(pass(optional).consent).toBe(false);
  });

  it('needs labels, and two answers for a multiple choice question', () => {
    const all = build('email', 'consent');
    expect(isPublishable(all)).toBe(true);
    expect(isPublishable(updateBlock(all, all[0]!.id, { label: '  ' }))).toBe(false);
    const withChoice = [...all, block('choice', all, 'Pick one')];
    expect(isPublishable(withChoice)).toBe(false);
    const filled = updateBlock(withChoice, withChoice[2]!.id, { options: ['A', 'B'] });
    expect(isPublishable(filled)).toBe(true);
  });
});

describe('stages', () => {
  const t = (blocks: TemplateBlock[], status: 'DRAFT' | 'PUBLISHED' = 'DRAFT') => ({
    id: 't1',
    name: 'T',
    archetype: 'giveaway' as const,
    version: 1,
    updatedAt: '2026-11-14T10:00:00.000Z',
    blocks,
    status,
  });

  it('starts at fields for an empty draft', () => {
    const s = stageStatuses(t([]));
    expect(s).toMatchObject({ archetype: 'complete', fields: 'inProgress', checks: 'notStarted' });
    expect(currentStage(s)).toBe('fields');
  });

  it('flags issues, then moves to publish when every check passes', () => {
    expect(stageStatuses(t(build('full_name'))).checks).toBe('issues');
    const ok = stageStatuses(t(build('email', 'consent')));
    expect(ok.checks).toBe('complete');
    expect(currentStage(ok)).toBe('publish');
    expect(stageStatuses(t(build('email', 'consent'), 'PUBLISHED')).publish).toBe('complete');
  });
});
