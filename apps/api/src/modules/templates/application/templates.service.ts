import { NotFoundError } from '@/shared/errors';
import type { CampaignTemplate } from '../domain/model';

/** Reads the built-in campaign types. They are the same for every business. */
export interface TemplateRepository {
  list(): Promise<CampaignTemplate[]>;
  get(id: string): Promise<CampaignTemplate | null>;
  many(ids: readonly string[]): Promise<CampaignTemplate[]>;
}

export class TemplateNotFoundError extends NotFoundError {
  constructor() {
    super('Template not found');
  }
}

export class TemplatesService {
  constructor(private readonly repo: TemplateRepository) {}

  list(): Promise<CampaignTemplate[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<CampaignTemplate> {
    const found = await this.repo.get(id);
    if (!found) throw new TemplateNotFoundError();
    return found;
  }

  many(ids: readonly string[]): Promise<CampaignTemplate[]> {
    return this.repo.many(ids);
  }
}
