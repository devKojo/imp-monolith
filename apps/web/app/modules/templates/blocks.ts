import type { IconName } from '@imp/ui/app/icons';
import type { BlockKind } from './types';

export type BlockDef = {
  icon: IconName;
  group: 'identity' | 'engagement';
  /** Default machine name; made unique when a second block of the same kind is added. */
  key: string;
  /** Proves who the participant is (counts for the identity check). */
  verifiesIdentity: boolean;
  /** Starts as a required field. */
  required: boolean;
};

export const BLOCK_DEFS: Record<BlockKind, BlockDef> = {
  full_name: {
    icon: 'user',
    group: 'identity',
    key: 'full_name',
    verifiesIdentity: false,
    required: true,
  },
  email: { icon: 'mail', group: 'identity', key: 'email', verifiesIdentity: true, required: true },
  phone: {
    icon: 'ticket',
    group: 'identity',
    key: 'phone',
    verifiesIdentity: true,
    required: true,
  },
  address: {
    icon: 'globe',
    group: 'identity',
    key: 'delivery_address',
    verifiesIdentity: false,
    required: false,
  },
  wallet: {
    icon: 'cash',
    group: 'identity',
    key: 'wallet_address',
    verifiesIdentity: false,
    required: false,
  },
  choice: {
    icon: 'clipboard-list',
    group: 'engagement',
    key: 'question',
    verifiesIdentity: false,
    required: true,
  },
  likert: {
    icon: 'bar-chart',
    group: 'engagement',
    key: 'rating',
    verifiesIdentity: false,
    required: true,
  },
  upload: {
    icon: 'upload',
    group: 'engagement',
    key: 'document',
    verifiesIdentity: false,
    required: false,
  },
  text: {
    icon: 'pencil',
    group: 'engagement',
    key: 'answer',
    verifiesIdentity: false,
    required: false,
  },
  consent: {
    icon: 'shield-check',
    group: 'engagement',
    key: 'consent',
    verifiesIdentity: false,
    required: true,
  },
};

export const IDENTITY_KINDS = (Object.keys(BLOCK_DEFS) as BlockKind[]).filter(
  (k) => BLOCK_DEFS[k].group === 'identity',
);
export const ENGAGEMENT_KINDS = (Object.keys(BLOCK_DEFS) as BlockKind[]).filter(
  (k) => BLOCK_DEFS[k].group === 'engagement',
);
