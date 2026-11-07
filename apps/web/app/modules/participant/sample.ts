/**
 * Sample data for the participant hub. No participation API exists yet (ADR-P001 covers accounts
 * only), so the page shows these figures labelled as samples. Replace with the typed client when
 * participations are built; nothing here is real, personal or persisted.
 */
import type { IconName } from '@imp/ui/app/icons';

export type SampleDraw = {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  whenDays: number;
  ticket: string;
  confirmed: boolean;
};

export const participantSample = {
  activeEntries: 4,
  rewardsReady: 1,
  rewardsValue: 'GHS 500',
  nextDrawHours: 48,
  claim: {
    amount: 'GHS 500',
    title: 'Weekend getaway voucher',
    expiresInDays: 14,
  },
  instantWin: { reference: '9912', odds: 4, prize: 'GHS 50 voucher' },
  draws: [
    {
      id: 'd1',
      icon: 'trophy',
      title: 'Grand prize draw',
      subtitle: 'Savanna Travel · Black Friday',
      whenDays: 2,
      ticket: '8492',
      confirmed: true,
    },
    {
      id: 'd2',
      icon: 'gift',
      title: 'Weekly giveaway',
      subtitle: 'Accra Coffee · Loyalty',
      whenDays: 5,
      ticket: '7210',
      confirmed: true,
    },
  ] satisfies SampleDraw[],
};
