import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '@/modules/identity';
import { createTenantContext } from '@/shared/database';
import { needsDestination, validateDestination, type DestinationInput } from '../domain/claim';
import {
  AwardExpiredError,
  AwardNotClaimableError,
  AwardNotFoundError,
  ClaimEmailNotVerifiedError,
  ClaimInvalidError,
  ParticipantOnlyError,
} from '../domain/errors';
import type { ClaimDestination, MyAwardDetail, MyAwardsPage, WalletBalance } from '../domain/model';
import { REPORT_SEVERITY, type ReportReason } from '../domain/risk';
import type { RateLimit } from '../infrastructure/attempt-limiter';
import type { SecretBox } from '../infrastructure/secret-box';
import type { MyRewardsRepository } from './my-ports';

/** Proves the signed-in person still knows their password (throws if not). */
export type StepUp = (who: CurrentUser, password: string) => Promise<void>;

export type ClaimInput = DestinationInput & { password?: string | undefined };
export type ClaimResult = {
  awardId: string;
  status: string;
  claimHint: string | null;
  alreadyClaimed: boolean;
};

/**
 * A participant's rewards and claiming them. The person always comes from the session, never from the
 * request. Claiming is guarded in layers: a participant account, a verified address, a limit on attempts,
 * and for money and items a re-entered password plus a destination that is stored encrypted. The final
 * check is atomic in the database, so two racing claims cannot both go through.
 */
export class MyRewardsService {
  constructor(
    private readonly repo: MyRewardsRepository,
    private readonly box: SecretBox,
    private readonly stepUp: StepUp,
    private readonly limiter: RateLimit,
    /** How many scam reports one person may send in a day. */
    private readonly reports: RateLimit,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private participant(who: CurrentUser | null): CurrentUser {
    if (who?.accountType !== 'PARTICIPANT') throw new ParticipantOnlyError();
    return who;
  }

  async list(
    who: CurrentUser | null,
    page: { limit: number; offset: number },
  ): Promise<MyAwardsPage> {
    return this.repo.list(this.participant(who).userId, page, this.now());
  }

  async wallet(who: CurrentUser | null): Promise<{ items: WalletBalance[] }> {
    return { items: await this.repo.wallet(this.participant(who).userId) };
  }

  async get(who: CurrentUser | null, awardId: string): Promise<MyAwardDetail> {
    const found = await this.repo.get(this.participant(who).userId, awardId, this.now());
    if (!found) throw new AwardNotFoundError();
    return found;
  }

  /**
   * A winner reports that an award looks like a scam (asked to pay a fee, strange contact, never received).
   * The report goes to the platform; the business cannot read it or tell who sent it. Limited per person, and
   * a repeat of the same report is accepted without adding another.
   */
  async report(
    who: CurrentUser | null,
    awardId: string,
    input: { reason: ReportReason; details?: string | undefined },
  ): Promise<{ reported: true }> {
    const me = this.participant(who);
    await this.reports.hit(me.userId);
    const target = await this.repo.locate(me.userId, awardId);
    if (!target) throw new AwardNotFoundError();
    await this.repo.report(
      createTenantContext({
        tenantId: target.tenantId,
        actorId: me.userId,
        requestId: randomUUID(),
      }),
      {
        awardId,
        campaignId: target.campaignId,
        userId: me.userId,
        reason: input.reason,
        details: (input.details ?? '').trim(),
        severity: REPORT_SEVERITY[input.reason],
      },
    );
    return { reported: true };
  }

  async claim(who: CurrentUser | null, awardId: string, input: ClaimInput): Promise<ClaimResult> {
    const me = this.participant(who);
    // Every attempt counts, so a stolen session cannot probe at speed.
    await this.limiter.hit(me.userId);

    const target = await this.repo.locate(me.userId, awardId);
    if (!target) throw new AwardNotFoundError();

    let destination: ClaimDestination | null = null;
    if (needsDestination(target.kind)) {
      if (!me.emailVerified) throw new ClaimEmailNotVerifiedError();
      const checked = validateDestination(input);
      if (!checked.ok) throw new ClaimInvalidError(checked.problem);
      if (!input.password)
        throw new ClaimInvalidError('Confirm your password to claim this reward');
      await this.stepUp(me, input.password);
      const v = checked.value;
      destination = {
        method: v.method,
        accountName: v.accountName,
        encrypted: this.box.encrypt(v.destination),
        // The method is part of the fingerprint: the same digits mean different things for a phone and a bank.
        fingerprint: this.box.fingerprint(`${v.method}:${v.destination}`),
        hint: v.hint,
      };
    }

    const out = await this.repo.claim(
      createTenantContext({
        tenantId: target.tenantId,
        actorId: me.userId,
        requestId: randomUUID(),
      }),
      { awardId, userId: me.userId, now: this.now(), destination },
    );
    switch (out.kind) {
      case 'claimed':
        return { awardId, status: out.status, claimHint: out.hint, alreadyClaimed: false };
      case 'already':
        return { awardId, status: out.status, claimHint: out.hint, alreadyClaimed: true };
      case 'expired':
        throw new AwardExpiredError();
      case 'blocked':
        throw new AwardNotClaimableError(out.status);
      case 'missing':
        throw new AwardNotFoundError();
    }
  }
}
