import type { IconName } from './icons';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type StatusDef = { label: string; icon: IconName; tone: Tone; meaning: string };

/**
 * Fixed status vocabularies (UI-DSH-05): one chip component, many vocabularies, always
 * icon + text + colour. Add states here, never as one-off chips in a feature.
 * Campaign: UI spec 7.2. Others: architecture spec 9.6, 9.7, 9.9, 17.
 */
export const statusVocabularies = {
  campaign: {
    DRAFT: {
      label: 'Draft',
      icon: 'pencil',
      tone: 'neutral',
      meaning: 'Editable; not visible to participants',
    },
    IN_REVIEW: { label: 'In review', icon: 'eye', tone: 'info', meaning: 'Awaiting approval' },
    SCHEDULED: {
      label: 'Scheduled',
      icon: 'clock',
      tone: 'info',
      meaning: 'Will go live at start time',
    },
    LIVE: { label: 'Live', icon: 'dot', tone: 'success', meaning: 'Accepting participation' },
    PAUSED: {
      label: 'Paused',
      icon: 'pause',
      tone: 'warning',
      meaning: 'Paused by a user; resumable',
    },
    PAUSED_BY_PLATFORM: {
      label: 'Paused by platform',
      icon: 'pause-shield',
      tone: 'warning',
      meaning:
        'System-paused (for example business suspended); not resumable by the business until cleared',
    },
    COMPLETED: {
      label: 'Completed',
      icon: 'check',
      tone: 'neutral',
      meaning: 'Closed; results frozen',
    },
    CANCELLED: {
      label: 'Cancelled',
      icon: 'x',
      tone: 'danger',
      meaning: 'Closed without completion',
    },
    ARCHIVED: {
      label: 'Archived',
      icon: 'box',
      tone: 'neutral',
      meaning: 'Read-only; slug reserved',
    },
  },
  rewardUnit: {
    AVAILABLE: { label: 'Available', icon: 'box', tone: 'neutral', meaning: 'In stock' },
    ALLOCATED: { label: 'Allocated', icon: 'clock', tone: 'info', meaning: 'Assigned to an entry' },
    HELD: { label: 'Held', icon: 'pause', tone: 'warning', meaning: 'Held for fraud review' },
    CLAIMED: { label: 'Claimed', icon: 'check', tone: 'info', meaning: 'Winner has claimed' },
    FULFILLED: {
      label: 'Fulfilled',
      icon: 'check-circle',
      tone: 'success',
      meaning: 'Delivered with proof',
    },
    EXPIRED: { label: 'Expired', icon: 'clock', tone: 'neutral', meaning: 'Claim window elapsed' },
    FORFEITED: {
      label: 'Forfeited',
      icon: 'x',
      tone: 'neutral',
      meaning: 'Declined or ineligible',
    },
    REVOKED: {
      label: 'Revoked',
      icon: 'x-circle',
      tone: 'danger',
      meaning: 'Removed after review',
    },
  },
  template: {
    DRAFT: {
      label: 'Draft',
      icon: 'pencil',
      tone: 'neutral',
      meaning: 'Editable; not ready for campaigns',
    },
    PUBLISHED: {
      label: 'Published',
      icon: 'check-circle',
      tone: 'success',
      meaning: 'Passed every check; ready for campaigns',
    },
  },
  moderation: {
    PENDING_REVIEW: {
      label: 'Pending review',
      icon: 'eye',
      tone: 'info',
      meaning: 'Waiting for a moderator',
    },
    APPROVED: {
      label: 'Approved',
      icon: 'check-circle',
      tone: 'success',
      meaning: 'Visible to participants',
    },
    REJECTED: { label: 'Rejected', icon: 'x-circle', tone: 'danger', meaning: 'Not shown' },
    ESCALATED: {
      label: 'Escalated',
      icon: 'alert-triangle',
      tone: 'warning',
      meaning: 'Needs a second opinion',
    },
  },
  delivery: {
    PENDING: { label: 'Pending', icon: 'clock', tone: 'neutral', meaning: 'Queued' },
    SENDING: { label: 'Sending', icon: 'refresh', tone: 'info', meaning: 'Handed to the provider' },
    SENT: {
      label: 'Sent',
      icon: 'check-circle',
      tone: 'success',
      meaning: 'Accepted by the provider',
    },
    FAILED: {
      label: 'Failed',
      icon: 'x-circle',
      tone: 'danger',
      meaning: 'Could not be delivered',
    },
    UNKNOWN: {
      label: 'Checking',
      icon: 'help',
      tone: 'warning',
      meaning: 'Waiting for the provider to confirm',
    },
  },
  risk: {
    LOW_RISK: { label: 'Low', icon: 'check', tone: 'success', meaning: 'No concerns' },
    REVIEW_REQUIRED: {
      label: 'Review',
      icon: 'alert-triangle',
      tone: 'warning',
      meaning: 'Needs a manual check',
    },
    REJECTED: {
      label: 'Rejected',
      icon: 'x-circle',
      tone: 'danger',
      meaning: 'Entry not accepted',
    },
  },
} as const satisfies Record<string, Record<string, StatusDef>>;

export type StatusVocabulary = keyof typeof statusVocabularies;
export type StatusCode<V extends StatusVocabulary> = keyof (typeof statusVocabularies)[V];
