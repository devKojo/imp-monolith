import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { TemplateRepository } from '../application/templates.service';
import { groupOf, type Archetype, type CampaignTemplate, type FieldKind } from '../domain/model';

const withFields = {
  fields: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.CampaignTemplateInclude;
type Row = Prisma.CampaignTemplateGetPayload<{ include: typeof withFields }>;

const toTemplate = (r: Row): CampaignTemplate => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  archetype: r.archetype.toLowerCase() as Archetype,
  description: r.description,
  minContentFields: r.minContentFields,
  requiresPrizes: r.requiresPrizes,
  fields: r.fields.map((f) => {
    const kind = f.kind.toLowerCase() as FieldKind;
    return {
      kind,
      group: groupOf(kind),
      maxCount: f.maxCount,
      defaultCount: f.defaultCount,
      defaultLabel: f.defaultLabel,
      defaultRequired: f.defaultRequired,
    };
  }),
});

/**
 * The built-in types in PostgreSQL. They belong to no business, so there is no tenant scope: the tables
 * are global and the runtime role can only read them.
 */
export class PrismaTemplateRepository implements TemplateRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<CampaignTemplate[]> {
    const rows = await this.db.campaignTemplate.findMany({
      orderBy: { position: 'asc' },
      include: withFields,
    });
    return rows.map(toTemplate);
  }

  async get(id: string): Promise<CampaignTemplate | null> {
    const row = await this.db.campaignTemplate.findUnique({ where: { id }, include: withFields });
    return row ? toTemplate(row) : null;
  }

  async many(ids: readonly string[]): Promise<CampaignTemplate[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.campaignTemplate.findMany({
      where: { id: { in: [...ids] } },
      include: withFields,
    });
    return rows.map(toTemplate);
  }
}
