import type { TenantTx } from '@/shared/database';
import { CampaignFullError } from '../domain/errors';

/**
 * Takes one participant seat on a campaign, in the caller's transaction (so it is undone if the caller's
 * own write fails). Call it once, when a participant first joins; people already in do not take another.
 *
 * It is one UPDATE: the count goes up only while it is below the pool's limit, and the update that takes
 * the last seat also closes the campaign (status COMPLETED, version bumped). Because the check and the
 * write are a single statement, two people racing for the last seat cannot both get it. A campaign without
 * a prize pool has no limit; it still counts who has joined.
 *
 * A stored COMPLETED status with an end date still ahead only ever means "full": the schedule's own
 * completion is computed, never stored. People who already hold a seat can still finish what they started.
 *
 * @throws CampaignFullError when no seat is left.
 */
export async function claimSeat(tx: TenantTx, tenantId: string, campaignId: string): Promise<void> {
  const taken = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "campaigns" SET
      "participant_count" = "participant_count" + 1,
      "status" = CASE
        WHEN ("settings"->'pool'->>'maxParticipants') IS NOT NULL
          AND "participant_count" + 1 >= ("settings"->'pool'->>'maxParticipants')::int
        THEN 'COMPLETED'::"CampaignStatus" ELSE "status" END,
      "version" = CASE
        WHEN ("settings"->'pool'->>'maxParticipants') IS NOT NULL
          AND "participant_count" + 1 >= ("settings"->'pool'->>'maxParticipants')::int
        THEN "version" + 1 ELSE "version" END
    WHERE "id" = ${campaignId}::uuid
      AND "tenant_id" = ${tenantId}::uuid
      AND "deleted_at" IS NULL
      AND (
        ("settings"->'pool'->>'maxParticipants') IS NULL
        OR "participant_count" < ("settings"->'pool'->>'maxParticipants')::int
      )
    RETURNING "id"`;
  if (taken.length === 0) throw new CampaignFullError();
}
