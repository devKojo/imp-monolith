/**
 * Participants as a business sees them: who took part in its campaigns and how far they got. Read-only;
 * the facts come from quiz attempts and survey responses, which belong to the `quiz` and `survey` modules.
 * Only a name is ever shown: no email, no answers.
 */
export type ParticipationKind = 'quiz' | 'survey';
export type ParticipationStatus = 'in_progress' | 'completed';

/** One participant's participation in one campaign. */
export type Participation = {
  /** The attempt or response id. */
  id: string;
  kind: ParticipationKind;
  /** The participant's account id, so the same person can be recognised across campaigns. */
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

/** Started and completed counts for one campaign that has any participation. */
export type CampaignParticipation = {
  campaignId: string;
  title: string;
  kind: ParticipationKind;
  started: number;
  completed: number;
};

export type ParticipantSummary = {
  /** Different people who took part in any campaign of the business. */
  participants: number;
  started: number;
  completed: number;
  campaigns: CampaignParticipation[];
};

/** One day of a campaign's activity: participations started and completed that day (UTC). */
export type DailyActivity = { date: string; started: number; completed: number };

/**
 * How one campaign is going, for the participation summary: totals, the last days of activity and, for
 * a quiz, how those who finished did. No names, no answers.
 */
export type CampaignActivity = {
  campaignId: string;
  title: string;
  kind: ParticipationKind;
  started: number;
  completed: number;
  /** Days covered by `daily`, oldest first, ending today (UTC); days without activity are zeros. */
  daily: DailyActivity[];
  /** Quiz only: passed and not passed among those who finished, and the overall share answered correctly. */
  quiz: { passed: number; failed: number; correctPercent: number | null } | null;
};

/** How the whole business is going, for the overview: the last days of activity and quiz outcomes. */
export type BusinessActivity = {
  /** Oldest first, ending today (UTC); days without activity are zeros. */
  daily: DailyActivity[];
  /** Passed and not passed across every quiz attempt that was finished; null when none were. */
  quiz: { passed: number; failed: number; correctPercent: number | null } | null;
};

/** Days of activity shown. */
export const ACTIVITY_DAYS = 14;

/** The acting person: from the session's active membership, never from the request. */
export type Actor = { userId: string; tenantId: string; role: string };

export type ListQuery = {
  campaignId?: string;
  status?: ParticipationStatus;
  limit: number;
  offset: number;
};
