/**
 * Sample templates for the business console. There is no templates API yet, so the library starts
 * with these labelled examples and keeps changes in memory for the session. Replace with the typed
 * client when the module lands; nothing here is persisted.
 */
import { createBlock, updateBlock } from './logic';
import type { BlockKind, CampaignTemplate, TemplateBlock } from './types';

const build = (id: string, specs: Array<[BlockKind, string]>): TemplateBlock[] =>
  specs.reduce<TemplateBlock[]>(
    (all, [kind, label], i) => [...all, createBlock(kind, label, `${id}-b${i + 1}`, all)],
    [],
  );

const quizBlocks = (): TemplateBlock[] => {
  const blocks = build('tpl-quiz', [
    ['full_name', 'Full name'],
    ['email', 'Email address'],
    ['choice', 'Which product line do you use most?'],
  ]);
  return updateBlock(blocks, 'tpl-quiz-b3', { options: ['Everyday', 'Premium', 'Business'] });
};

export const sampleTemplates = (): CampaignTemplate[] => [
  {
    id: 'tpl-giveaway',
    name: 'Black Friday giveaway entry',
    archetype: 'giveaway',
    status: 'PUBLISHED',
    blocks: build('tpl-giveaway', [
      ['email', 'Email address'],
      ['phone', 'Mobile phone number'],
      ['consent', 'I am 18 or older and accept the official rules'],
    ]),
    updatedAt: '2026-11-10T09:30:00.000Z',
  },
  {
    id: 'tpl-quiz',
    name: 'Product knowledge quiz',
    archetype: 'quiz',
    status: 'DRAFT',
    blocks: quizBlocks(),
    updatedAt: '2026-11-12T14:05:00.000Z',
  },
  {
    id: 'tpl-survey',
    name: 'Customer sentiment survey',
    archetype: 'survey',
    status: 'PUBLISHED',
    blocks: build('tpl-survey', [
      ['email', 'Email address'],
      ['likert', 'How likely are you to recommend us?'],
      ['text', 'Anything we could do better?'],
      ['consent', 'I agree to the privacy notice'],
    ]),
    updatedAt: '2026-11-05T16:45:00.000Z',
  },
];
