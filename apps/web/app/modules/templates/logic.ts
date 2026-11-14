import { BLOCK_DEFS } from './blocks';
import type {
  BlockKind,
  CampaignTemplate,
  PreflightCheck,
  StageId,
  StageStatus,
  TemplateBlock,
} from './types';

/** Pure helpers for the template builder: every function returns new data and never mutates. */

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The API's limits, so the form stops people before the server has to. */
export const LIMITS = {
  name: 120,
  label: 120,
  helper: 240,
  option: 120,
  options: 10,
  fields: 30,
} as const;

/** `email`, then `email_2`, `email_3`... so machine names stay unique inside a template. */
export function uniqueKey(base: string, blocks: readonly TemplateBlock[]): string {
  const taken = new Set(blocks.map((b) => b.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function createBlock(
  kind: BlockKind,
  label: string,
  id: string,
  blocks: readonly TemplateBlock[],
): TemplateBlock {
  const def = BLOCK_DEFS[kind];
  return {
    id,
    kind,
    key: uniqueKey(def.key, blocks),
    label,
    helper: '',
    required: def.required,
    options: kind === 'choice' ? ['', ''] : [],
  };
}

export function moveBlock(
  blocks: readonly TemplateBlock[],
  id: string,
  direction: -1 | 1,
): TemplateBlock[] {
  const from = blocks.findIndex((b) => b.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= blocks.length) return [...blocks];
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export function duplicateBlock(
  blocks: readonly TemplateBlock[],
  id: string,
  newId: string,
): TemplateBlock[] {
  const at = blocks.findIndex((b) => b.id === id);
  if (at < 0) return [...blocks];
  const source = blocks[at]!;
  const copy: TemplateBlock = {
    ...clone(source),
    id: newId,
    key: uniqueKey(source.key, blocks),
  };
  return [...blocks.slice(0, at + 1), copy, ...blocks.slice(at + 1)];
}

export const removeBlock = (blocks: readonly TemplateBlock[], id: string): TemplateBlock[] =>
  blocks.filter((b) => b.id !== id);

export const updateBlock = (
  blocks: readonly TemplateBlock[],
  id: string,
  patch: Partial<Omit<TemplateBlock, 'id' | 'kind' | 'key'>>,
): TemplateBlock[] => blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));

/**
 * Checks a template must pass before it can be published. Only things that can really be computed
 * from the template are checked: no claims about contrast or exports.
 */
export function preflight(blocks: readonly TemplateBlock[]): PreflightCheck[] {
  return [
    { id: 'fields', pass: blocks.length > 0 },
    { id: 'identity', pass: blocks.some((b) => BLOCK_DEFS[b.kind].verifiesIdentity) },
    { id: 'consent', pass: blocks.some((b) => b.kind === 'consent' && b.required) },
    {
      id: 'labels',
      pass:
        blocks.length > 0 &&
        blocks.every(
          (b) =>
            b.label.trim() !== '' &&
            (b.kind !== 'choice' || b.options.filter((o) => o.trim() !== '').length >= 2),
        ),
    },
  ];
}

export const isPublishable = (blocks: readonly TemplateBlock[]): boolean =>
  preflight(blocks).every((c) => c.pass);

/** Status of each builder stage, derived from the template so it can never disagree with it. */
export function stageStatuses(template: CampaignTemplate): Record<StageId, StageStatus> {
  const checks = preflight(template.blocks);
  const allPass = checks.every((c) => c.pass);
  const hasFields = template.blocks.length > 0;
  return {
    archetype: 'complete',
    fields: hasFields ? 'complete' : 'inProgress',
    checks: !hasFields ? 'notStarted' : allPass ? 'complete' : 'issues',
    publish: template.status === 'PUBLISHED' ? 'complete' : allPass ? 'inProgress' : 'notStarted',
  };
}

export function currentStage(statuses: Record<StageId, StageStatus>): StageId {
  const order: StageId[] = ['archetype', 'fields', 'checks', 'publish'];
  return order.find((s) => statuses[s] !== 'complete') ?? 'publish';
}
