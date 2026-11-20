import type { CurrentUser } from '@/modules/identity';
import { CLAIM_WINDOW_DAYS } from '@/modules/rewards';
import {
  DecisionNotAllowedError,
  NotPlatformStaffError,
  ReviewItemNotFoundError,
} from '../domain/errors';
import type { Decision, ReportPage, ReportStatus, ReviewPage } from '../domain/model';
import type { AdministrationRepository } from './ports';

/** Proves the signed-in person still knows their password (throws if not). */
export type StepUp = (who: CurrentUser, password: string) => Promise<void>;

/**
 * Platform review of rewards across businesses. Every call first proves the person is active platform staff
 * (looked up in the platform database, never taken from the request). A decision that changes what a winner
 * is owed also re-asks for the password, so a stolen session cannot clear or revoke awards. Decisions are
 * written to the award's history with the reviewer's id.
 */
export class AdministrationService {
  constructor(
    private readonly repo: AdministrationRepository,
    private readonly stepUp: StepUp,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async staff(who: CurrentUser | null): Promise<CurrentUser> {
    if (!who || !(await this.repo.isStaff(who.userId))) throw new NotPlatformStaffError();
    return who;
  }

  async me(who: CurrentUser | null): Promise<{ staff: true }> {
    await this.staff(who);
    return { staff: true };
  }

  async queue(
    who: CurrentUser | null,
    page: { limit: number; offset: number },
  ): Promise<ReviewPage> {
    await this.staff(who);
    return this.repo.queue(page);
  }

  async reports(
    who: CurrentUser | null,
    input: { status: ReportStatus; limit: number; offset: number },
  ): Promise<ReportPage> {
    await this.staff(who);
    return this.repo.reports(input);
  }

  async decide(
    who: CurrentUser | null,
    awardId: string,
    input: { decision: Decision; note: string; password: string },
  ): Promise<{ awardId: string; status: string }> {
    const me = await this.staff(who);
    await this.stepUp(me, input.password);
    const now = this.now();
    const r = await this.repo.decide({
      awardId,
      actorId: me.userId,
      decision: input.decision,
      note: input.note.trim(),
      now,
      claimBy: new Date(now.getTime() + CLAIM_WINDOW_DAYS * 86_400_000),
    });
    switch (r.kind) {
      case 'done':
        return { awardId, status: r.status };
      case 'blocked':
        throw new DecisionNotAllowedError(r.status);
      case 'missing':
        throw new ReviewItemNotFoundError();
    }
  }

  async resolve(
    who: CurrentUser | null,
    reportId: string,
    input: { status: 'REVIEWED' | 'DISMISSED'; note: string },
  ): Promise<{ reportId: string; status: string }> {
    const me = await this.staff(who);
    const r = await this.repo.resolve({
      reportId,
      actorId: me.userId,
      status: input.status,
      note: input.note.trim(),
      now: this.now(),
    });
    switch (r.kind) {
      case 'done':
        return { reportId, status: input.status };
      case 'already':
        // Someone else got there first: report what it is now rather than overwrite it.
        return { reportId, status: r.status };
      case 'missing':
        throw new ReviewItemNotFoundError();
    }
  }
}
