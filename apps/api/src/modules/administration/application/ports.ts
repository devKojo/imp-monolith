import type {
  Decision,
  DecisionOutcome,
  ReportPage,
  ReportStatus,
  ResolveOutcome,
  ReviewPage,
} from '../domain/model';

/** Storage for platform review. Runs on the platform database role, across every business. */
export interface AdministrationRepository {
  /** Whether this person is active platform staff. */
  isStaff(userId: string): Promise<boolean>;
  /** Awards waiting for review or held, riskiest first. */
  queue(page: { limit: number; offset: number }): Promise<ReviewPage>;
  reports(input: { status: ReportStatus; limit: number; offset: number }): Promise<ReportPage>;
  /**
   * Applies a platform decision under a row lock and writes the event naming the reviewer. Release is for
   * awards waiting for review or held; reject likewise; revoke also covers an award that is available or
   * claimed but not yet paid.
   */
  decide(input: {
    awardId: string;
    actorId: string;
    decision: Decision;
    note: string;
    now: Date;
    claimBy: Date;
  }): Promise<DecisionOutcome>;
  /** Marks an open report reviewed or dismissed, with who and when. */
  resolve(input: {
    reportId: string;
    actorId: string;
    status: 'REVIEWED' | 'DISMISSED';
    note: string;
    now: Date;
  }): Promise<ResolveOutcome>;
}
