export type ParticipationKind = 'quiz' | 'survey';
export type ParticipationStatus = 'in_progress' | 'completed';

/** One participant's participation in one campaign, as the business sees it: a name, never an email. */
export type Participation = {
  id: string;
  kind: ParticipationKind;
  participantId: string;
  name: string;
  campaignId: string;
  campaignTitle: string;
  /** Which attempt this is (a quiz can be retaken); 1 for a survey. */
  attempt: number;
  status: ParticipationStatus;
  startedAt: string;
  completedAt: string | null;
  /** A quiz's result once finished; null for a survey or an unfinished quiz. */
  result: { score: number; total: number; passed: boolean } | null;
};

export type ParticipationPage = { items: Participation[]; total: number };

export type CampaignParticipation = {
  campaignId: string;
  title: string;
  kind: ParticipationKind;
  started: number;
  completed: number;
};

export type ParticipantSummary = {
  participants: number;
  started: number;
  completed: number;
  campaigns: CampaignParticipation[];
};

export type ParticipationFilter = {
  campaignId: string;
  status: ParticipationStatus | 'all';
};

export type DailyActivity = { date: string; started: number; completed: number };

/** How one campaign is going: totals, the last days of activity and, for a quiz, how finishers did. */
export type CampaignActivity = {
  campaignId: string;
  title: string;
  kind: ParticipationKind;
  started: number;
  completed: number;
  /** Oldest first, ending today (UTC); days without activity are zeros. */
  daily: DailyActivity[];
  quiz: { passed: number; failed: number; correctPercent: number | null } | null;
};

/** How the whole business is going: the last days of activity and quiz outcomes. */
export type BusinessActivity = {
  /** Oldest first, ending today (UTC); days without activity are zeros. */
  daily: DailyActivity[];
  quiz: { passed: number; failed: number; correctPercent: number | null } | null;
};
