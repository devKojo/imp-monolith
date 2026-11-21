import type { PrismaClient } from '@/generated/prisma/client';
import { claimSeat } from '@/modules/campaigns';
import { recordSignal, withPublic, withTenant, type TenantContext } from '@/shared/database';
import type { VotingRepository } from '../application/ports';
import type {
  BallotField,
  BallotKind,
  ResultsVisibility,
  RunnableBallot,
  StoredVote,
  TallyRow,
  VoteTarget,
} from '../domain/model';

const KIND_OF = { POLL: 'poll', VOTE: 'vote' } as const;
const ARCHETYPES = ['POLL', 'VOTE'] as const;

/** The stored answers JSON, read defensively: only whole-number answers by question id. */
const answersOf = (value: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [id, n] of Object.entries(value)) if (Number.isInteger(n)) out[id] = n as number;
  }
  return out;
};

/** The settings column is JSON written by the campaigns module; read it defensively anyway. */
const showResultsOf = (settings: unknown): ResultsVisibility =>
  (settings as { ballot?: { showResults?: unknown } } | null)?.ballot?.showResults === 'live'
    ? 'live'
    : 'after_vote';

/** Thrown inside the transaction when the vote was already there, so the seat taken with it is undone. */
class AlreadyThere extends Error {}

/**
 * Votes in PostgreSQL. Every call is one `withTenant` transaction (row-level security applies) except
 * `locate`, which reads the same running campaigns the public listing shows through `withPublic`. The
 * options are the campaign's own content fields.
 */
export class PrismaVotingRepository implements VotingRepository {
  constructor(private readonly db: PrismaClient) {}

  fields(ctx: TenantContext, campaignId: string): Promise<BallotField[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.campaignField.findMany({
        where: { tenantId: ctx.tenantId, campaignId, kind: { in: ['CHOICE', 'CANDIDATE'] } },
        orderBy: { position: 'asc' },
      });
      return rows.map((f) => ({
        id: f.id,
        kind: f.kind === 'CANDIDATE' ? ('candidate' as const) : ('choice' as const),
        label: f.label,
        helper: f.helper,
        options: f.kind === 'CHOICE' ? f.options : [],
        imageUrl: f.imageUrl,
      }));
    });
  }

  locate(slug: string, now: Date): Promise<RunnableBallot | null> {
    return withPublic(this.db, async (tx) => {
      const row = await tx.campaign.findFirst({
        where: {
          slug,
          deletedAt: null,
          endAt: { gt: now },
          // COMPLETED here (with the end date still ahead) means a prize pool campaign that is full: people
          // already in can still see it; a new voter is refused when they try to take a seat.
          OR: [
            { status: 'LIVE' },
            { status: 'SCHEDULED', startAt: { lte: now } },
            { status: 'COMPLETED' },
          ],
          business: { status: { in: ['PENDING', 'ACTIVE'] } },
          template: { archetype: { in: [...ARCHETYPES] } },
        },
        select: {
          id: true,
          tenantId: true,
          title: true,
          summary: true,
          endAt: true,
          settings: true,
          business: { select: { name: true } },
          template: { select: { archetype: true } },
        },
      });
      const archetype = row?.template?.archetype;
      return row && row.endAt && (archetype === 'POLL' || archetype === 'VOTE')
        ? {
            campaignId: row.id,
            tenantId: row.tenantId,
            kind: KIND_OF[archetype],
            title: row.title,
            summary: row.summary,
            businessName: row.business.name,
            endAt: row.endAt,
            showResults: showResultsOf(row.settings),
          }
        : null;
    });
  }

  find(
    ctx: TenantContext,
    campaignId: string,
  ): Promise<{ kind: BallotKind; title: string } | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.campaign.findFirst({
        where: {
          id: campaignId,
          tenantId: ctx.tenantId,
          deletedAt: null,
          template: { archetype: { in: [...ARCHETYPES] } },
        },
        select: { title: true, template: { select: { archetype: true } } },
      });
      const archetype = row?.template?.archetype;
      return row && (archetype === 'POLL' || archetype === 'VOTE')
        ? { kind: KIND_OF[archetype], title: row.title }
        : null;
    });
  }

  vote(ctx: TenantContext, campaignId: string, userId: string): Promise<StoredVote | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.vote.findFirst({
        where: { tenantId: ctx.tenantId, campaignId, userId },
        select: { fieldId: true, choiceIndex: true, answers: true, castAt: true },
      });
      return row
        ? {
            fieldId: row.fieldId,
            choiceIndex: row.choiceIndex,
            answers: answersOf(row.answers),
            castAt: row.castAt,
          }
        : null;
    });
  }

  async cast(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; at: Date } & VoteTarget,
  ): Promise<StoredVote | null> {
    try {
      return await withTenant(this.db, ctx, async (tx) => {
        // Voting takes a seat on the campaign (a prize pool campaign has a limited number).
        await claimSeat(tx, ctx.tenantId, input.campaignId);
        await recordSignal(tx, {
          tenantId: ctx.tenantId,
          campaignId: input.campaignId,
          userId: input.userId,
          kind: 'JOIN',
        });
        // The unique (business, campaign, participant) key makes a double click or a second tab insert
        // nothing; throwing then rolls the seat back, so it is only ever taken once.
        const { count } = await tx.vote.createMany({
          data: [
            {
              tenantId: ctx.tenantId,
              campaignId: input.campaignId,
              userId: input.userId,
              fieldId: input.fieldId,
              choiceIndex: input.choiceIndex,
              // Only a poll keeps answers; an image vote's candidate is its field.
              ...(input.choiceIndex === null ? {} : { answers: input.answers }),
              castAt: input.at,
            },
          ],
          skipDuplicates: true,
        });
        if (count === 0) throw new AlreadyThere();
        return {
          fieldId: input.fieldId,
          choiceIndex: input.choiceIndex,
          answers: input.answers,
          castAt: input.at,
        };
      });
    } catch (e) {
      if (e instanceof AlreadyThere) return null;
      throw e;
    }
  }

  /**
   * Votes counted per stored target. An image vote counts by candidate. A poll counts by question and answer:
   * from its stored answers, or, for a vote cast when the poll had one question, from its field and choice.
   */
  tally(ctx: TenantContext, campaignId: string): Promise<TallyRow[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ field_id: string; choice_index: number | null; votes: number }>
      >`
        SELECT v.field_id::text AS field_id, NULL::int AS choice_index, count(*)::int AS votes
          FROM votes v
         WHERE v.tenant_id = ${ctx.tenantId}::uuid AND v.campaign_id = ${campaignId}::uuid
           AND v.choice_index IS NULL
         GROUP BY v.field_id
        UNION ALL
        SELECT a.key AS field_id, a.value::int AS choice_index, count(*)::int AS votes
          FROM votes v
          CROSS JOIN LATERAL jsonb_each_text(
            COALESCE(v.answers, jsonb_build_object(v.field_id::text, v.choice_index))
          ) AS a(key, value)
         WHERE v.tenant_id = ${ctx.tenantId}::uuid AND v.campaign_id = ${campaignId}::uuid
           AND v.choice_index IS NOT NULL
         GROUP BY a.key, a.value`;
      return rows.map((r) => ({
        fieldId: r.field_id,
        choiceIndex: r.choice_index,
        votes: r.votes,
      }));
    });
  }
}
