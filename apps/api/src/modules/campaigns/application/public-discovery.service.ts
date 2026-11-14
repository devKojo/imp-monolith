import { NotFoundError } from '@/shared/errors';
import {
  PAGE_SIZE,
  archetypesFor,
  decodeCursor,
  encodeCursor,
  toPublic,
  type Cursor,
  type PublicCampaign,
  type PublicRow,
  type PublicType,
} from '../domain/public';

/** What the repository is asked for. `archetypes` empty means "no template kind matches". */
export type PublicQuery = {
  q?: string;
  /** One campaign by its public address. */
  slug?: string;
  archetypes?: string[];
  after?: Cursor;
  limit: number;
  now: Date;
};

/** Reads the running campaigns of every business. Read-only, and only what the public may see. */
export interface PublicCampaignRepository {
  find(query: PublicQuery): Promise<PublicRow[]>;
}

/**
 * The public listing: running campaigns, soonest to close first, a page at a time. There is no actor
 * and no tenant here on purpose; the repository can only read published rows.
 */
export class PublicDiscoveryService {
  constructor(
    private readonly repo: PublicCampaignRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(query: {
    q?: string | undefined;
    type?: PublicType | undefined;
    cursor?: string | undefined;
  }): Promise<{ items: PublicCampaign[]; nextCursor: string | null }> {
    const after = query.cursor ? decodeCursor(query.cursor) : undefined;
    const archetypes = query.type ? archetypesFor(query.type) : undefined;
    if (archetypes && archetypes.length === 0) return { items: [], nextCursor: null };

    const rows = await this.repo.find({
      ...(query.q ? { q: query.q } : {}),
      ...(archetypes ? { archetypes } : {}),
      ...(after ? { after } : {}),
      limit: PAGE_SIZE + 1,
      now: this.now(),
    });
    const page = rows.slice(0, PAGE_SIZE);
    const last = page[page.length - 1];
    return {
      items: page.map(toPublic),
      nextCursor:
        rows.length > PAGE_SIZE && last ? encodeCursor({ endAt: last.endAt, id: last.id }) : null,
    };
  }

  /** One running campaign by its address. Anything not public is the same "not found". */
  async get(slug: string): Promise<PublicCampaign> {
    const [row] = await this.repo.find({ slug, limit: 1, now: this.now() });
    if (!row) throw new NotFoundError('Campaign not found');
    return toPublic(row);
  }
}
