import { randomUUID } from 'node:crypto';
import { InMemoryCampaignRepository } from './fakes';
import { repositoryContract } from './repository.contract';

repositoryContract('in-memory', () => ({
  repo: new InMemoryCampaignRepository(),
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  userA: randomUUID(),
  templateA: randomUUID(),
}));
