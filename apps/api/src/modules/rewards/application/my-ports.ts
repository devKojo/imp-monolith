import type { TenantContext } from '@/shared/database';
import type {
  ClaimDestination,
  ClaimOutcome,
  ClaimTarget,
  MyAwardDetail,
  MyAwardsPage,
  WalletBalance,
} from '../domain/model';

/** Storage for a participant's own awards and claims. Reads use the participant scope; the claim write uses the award's business scope. */
export interface MyRewardsRepository {
  list(userId: string, page: { limit: number; offset: number }, now: Date): Promise<MyAwardsPage>;
  get(userId: string, awardId: string, now: Date): Promise<MyAwardDetail | null>;
  /** Points held with each business, largest first; businesses with nothing left are left out. */
  wallet(userId: string): Promise<WalletBalance[]>;
  /** Which business an award belongs to and what it is, or null if it is not this person's. */
  locate(userId: string, awardId: string): Promise<ClaimTarget | null>;
  /**
   * Claims the award for its winner in one transaction: moves it to claimed only if it is still available
   * and inside its window, records the claim signals and event, stores the destination, and credits points
   * when the award is points. A repeat of a claim that already went through returns `already`.
   */
  /** Records a winner's scam report against one of their awards. One per award, person and reason. */
  report(
    ctx: TenantContext,
    input: {
      awardId: string;
      campaignId: string;
      userId: string;
      reason: string;
      details: string;
      severity: number;
    },
  ): Promise<void>;
  claim(
    ctx: TenantContext,
    input: {
      awardId: string;
      userId: string;
      now: Date;
      destination: ClaimDestination | null;
    },
  ): Promise<ClaimOutcome>;
}
