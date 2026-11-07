/**
 * Sample data for the business console. Campaign, participant and draw APIs do not exist yet, so
 * the console shows these figures labelled as samples. Replace with the typed client as each
 * module lands; nothing here is real or persisted.
 */
import type { IconName } from '@imp/ui/app/icons';

export type SampleCampaign = {
  id: string;
  icon: IconName;
  name: string;
  detail: string;
  type: string;
  status: 'LIVE' | 'SCHEDULED' | 'PAUSED';
  entries: string;
};

export const businessSample = {
  participants: { value: '148,290', change: 'Up 12.4%', newCount: '+16,340 new' },
  campaigns: { live: 6, total: 8, scheduled: 1, nextLaunch: 'Next launch: 1 Dec' },
  drawHealth: { value: '100%', anomalies: 0 },
  nextDraw: {
    title: 'Black Friday grand draw',
    countdown: 'In 14 hours',
    winners: 5,
    pool: '68,419',
  },
  campaignRows: [
    {
      id: 'c1',
      icon: 'trophy',
      name: 'Black Friday grand draw',
      detail: 'Ends in 14 days',
      type: 'Giveaway',
      status: 'LIVE',
      entries: '68,419',
    },
    {
      id: 'c2',
      icon: 'gift',
      name: 'Instant mystery box',
      detail: 'Instant settlement',
      type: 'Instant win',
      status: 'LIVE',
      entries: '41,200',
    },
    {
      id: 'c3',
      icon: 'clipboard-list',
      name: 'Product knowledge quiz',
      detail: 'Knowledge quiz',
      type: 'Quiz',
      status: 'LIVE',
      entries: '22,540',
    },
    {
      id: 'c4',
      icon: 'calendar',
      name: 'December VIP pass',
      detail: 'Starts 1 Dec',
      type: 'Giveaway',
      status: 'SCHEDULED',
      entries: '—',
    },
    {
      id: 'c5',
      icon: 'pause',
      name: 'Regional referral pool',
      detail: 'Budget capped',
      type: 'Referral',
      status: 'PAUSED',
      entries: '16,131',
    },
  ] satisfies SampleCampaign[],
};
