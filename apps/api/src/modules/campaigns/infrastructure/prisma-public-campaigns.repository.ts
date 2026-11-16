import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { withPublic } from '@/shared/database';
import type {
  PublicCampaignRepository,
  PublicQuery,
} from '../application/public-discovery.service';
import type { PublicRow } from '../domain/public';

/**
 * The public listing in PostgreSQL. It reads inside `withPublic`, so only the read-only `public_read`
 * policies apply: running campaigns, their first prize, the template kind and the business name.
 * The conditions below repeat what those policies allow, so the query is explicit and can use the
 * indexes; the policies are what actually guarantee nothing else is reachable.
 */
export class PrismaPublicCampaignRepository implements PublicCampaignRepository {
  constructor(private readonly db: PrismaClient) {}

  find(query: PublicQuery): Promise<PublicRow[]> {
    const and: Prisma.CampaignWhereInput[] = [
      { deletedAt: null, archivedAt: null, slug: { not: null }, endAt: { gt: query.now } },
      { OR: [{ status: 'LIVE' }, { status: 'SCHEDULED', startAt: { lte: query.now } }] },
      { business: { status: { in: ['PENDING', 'ACTIVE'] } } },
    ];
    if (query.slug) and.push({ slug: query.slug });
    if (query.archetypes) {
      and.push({
        template: {
          archetype: { in: query.archetypes.map((a) => a.toUpperCase() as 'GIVEAWAY') },
        },
      });
    }
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      and.push({
        OR: [
          { title: contains },
          { summary: contains },
          { business: { name: contains } },
          { prizes: { some: { OR: [{ name: contains }, { valueLabel: contains }] } } },
        ],
      });
    }
    if (query.after) {
      and.push({
        OR: [
          { endAt: { gt: query.after.endAt } },
          { endAt: query.after.endAt, id: { gt: query.after.id } },
        ],
      });
    }

    return withPublic(this.db, async (tx) => {
      const rows = await tx.campaign.findMany({
        where: { AND: and },
        orderBy: [{ endAt: 'asc' }, { id: 'asc' }],
        take: query.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          endAt: true,
          startAt: true,
          template: { select: { archetype: true } },
          business: { select: { name: true } },
          prizes: {
            orderBy: { position: 'asc' },
            // The listing shows one prize; a campaign's own page shows every tier.
            ...(query.slug ? {} : { take: 1 }),
            select: { name: true, valueLabel: true, winners: true, description: true },
          },
        },
      });
      return rows.flatMap((r): PublicRow[] =>
        r.slug && r.endAt && r.template
          ? [
              {
                id: r.id,
                slug: r.slug,
                title: r.title,
                summary: r.summary,
                endAt: r.endAt,
                archetype: r.template.archetype.toLowerCase(),
                businessName: r.business.name,
                prize: r.prizes[0] ?? null,
                startAt: r.startAt,
                prizes: r.prizes,
              },
            ]
          : [],
      );
    });
  }
}
