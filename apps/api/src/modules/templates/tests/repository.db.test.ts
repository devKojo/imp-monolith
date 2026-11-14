/**
 * The repository contract against real PostgreSQL with the real roles and RLS. Skipped unless the
 * same TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as the isolation suite are set.
 */
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPlatformDb,
  createTenantContext,
  createTenantDb,
  withTenant,
} from '@/shared/database';
import { PrismaTemplateRepository } from '../infrastructure/prisma-template.repository';
import { repositoryContract, type ContractWorld } from './repository.contract';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
const tag = randomUUID().slice(0, 8);
let tenants: string[] = [];
let userId = '';

if (enabled) {
  repositoryContract('PostgreSQL', async (): Promise<ContractWorld> => {
    const [ba, bb] = await Promise.all([
      platform.business.create({ data: { name: `TplA-${tag}` } }),
      platform.business.create({ data: { name: `TplB-${tag}` } }),
    ]);
    const user = await platform.user.create({
      data: { email: `tpl-${tag}@test.local`, name: 'T' },
    });
    tenants = [ba.id, bb.id];
    userId = user.id;
    return {
      repo: new PrismaTemplateRepository(db),
      tenantA: ba.id,
      tenantB: bb.id,
      userA: user.id,
    };
  });
}

describe.skipIf(!enabled)('templates at the database level', () => {
  let tenantA = '';
  let tenantB = '';
  let templateId = '';
  const ctx = (tenantId: string) => createTenantContext({ tenantId, requestId: randomUUID() });

  beforeAll(async () => {
    const [ba, bb] = await Promise.all([
      platform.business.create({ data: { name: `RlsA-${tag}` } }),
      platform.business.create({ data: { name: `RlsB-${tag}` } }),
    ]);
    tenantA = ba.id;
    tenantB = bb.id;
    tenants.push(tenantA, tenantB);
    const t = await withTenant(db, ctx(tenantA), (tx) =>
      tx.template.create({
        data: { tenantId: tenantA, name: 'Secret', archetype: 'QUIZ', createdById: randomUUID() },
      }),
    );
    templateId = t.id;
    await withTenant(db, ctx(tenantA), (tx) =>
      tx.templateField.create({
        data: {
          tenantId: tenantA,
          templateId,
          position: 0,
          kind: 'EMAIL',
          key: 'email',
          label: 'Email',
        },
      }),
    );
  });

  afterAll(async () => {
    await platform.templateField.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.template.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.business.deleteMany({ where: { id: { in: tenants } } });
    if (userId) await platform.user.deleteMany({ where: { id: userId } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  it('shows nothing when no tenant is set (fails closed)', async () => {
    expect(await db.template.count()).toBe(0);
    expect(await db.templateField.count()).toBe(0);
  });

  it('hides a template and its fields from another business, even by id', async () => {
    const seen = await withTenant(db, ctx(tenantB), async (tx) => ({
      templates: await tx.template.findMany(),
      byId: await tx.template.findFirst({ where: { id: templateId } }),
      fields: await tx.templateField.findMany({ where: { templateId } }),
    }));
    expect(seen.templates).toEqual([]);
    expect(seen.byId).toBeNull();
    expect(seen.fields).toEqual([]);
  });

  it('blocks writing rows into another business', async () => {
    await expect(
      withTenant(db, ctx(tenantB), (tx) =>
        tx.template.create({
          data: {
            tenantId: tenantA,
            name: 'Planted',
            archetype: 'QUIZ',
            createdById: randomUUID(),
          },
        }),
      ),
    ).rejects.toThrow();
    const changed = await withTenant(db, ctx(tenantB), (tx) =>
      tx.template.updateMany({ where: { id: templateId }, data: { name: 'Hijacked' } }),
    );
    expect(changed.count).toBe(0);
  });

  it('does not let the runtime role hard-delete a template', async () => {
    await expect(
      withTenant(db, ctx(tenantA), (tx) => tx.template.deleteMany({ where: { id: templateId } })),
    ).rejects.toThrow();
  });

  it('rejects a field that points at another business template (composite foreign key)', async () => {
    await expect(
      platform.templateField.create({
        data: { tenantId: tenantB, templateId, position: 0, kind: 'TEXT', key: 'x', label: 'X' },
      }),
    ).rejects.toThrow();
  });

  it('enforces unique field names and the key format in the database', async () => {
    await expect(
      withTenant(db, ctx(tenantA), (tx) =>
        tx.templateField.create({
          data: {
            tenantId: tenantA,
            templateId,
            position: 1,
            kind: 'EMAIL',
            key: 'email',
            label: 'Dup',
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(db, ctx(tenantA), (tx) =>
        tx.templateField.create({
          data: {
            tenantId: tenantA,
            templateId,
            position: 2,
            kind: 'TEXT',
            key: 'Bad Key',
            label: 'Bad',
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('keeps the audit trail append-only', async () => {
    await expect(
      withTenant(
        db,
        ctx(tenantA),
        (tx) => tx.$executeRaw`DELETE FROM audit_log WHERE tenant_id = ${tenantA}::uuid`,
      ),
    ).rejects.toThrow();
  });
});
