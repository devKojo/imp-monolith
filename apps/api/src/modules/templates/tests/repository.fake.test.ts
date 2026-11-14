import { randomUUID } from 'node:crypto';
import { InMemoryTemplateRepository } from './fakes';
import { repositoryContract } from './repository.contract';

repositoryContract('in-memory', () => ({
  repo: new InMemoryTemplateRepository(),
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  userA: randomUUID(),
}));
