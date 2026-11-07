/**
 * R-TEN-05: every relation to a tenant-owned parent must be composite
 * (fields: [tenantId, x], references: [tenantId, id]); no single-column FK to a tenant table.
 * The tenant root (Business) is the one parent a plain tenantId FK may point at.
 */
import { fail, parseModels } from './lib/schema';

const TENANT_ROOT = 'Business';
const models = parseModels();
const isTenantTable = (name: string) =>
  name !== TENANT_ROOT &&
  !!models.find((m) => m.name === name)?.fields.some((f) => f.name === 'tenantId');

const problems: string[] = [];
for (const model of models) {
  for (const field of model.fields) {
    const rel = /@relation\(([^)]*)\)/.exec(field.attrs)?.[1];
    if (!rel) continue;
    const target = field.type.replace(/[?[\]]/g, '');
    const fields = /fields:\s*\[([^\]]*)\]/.exec(rel)?.[1];
    if (!fields || !isTenantTable(target)) continue; // back-reference side or non-tenant parent
    const parts = fields.split(',').map((s) => s.trim());
    const refs = (/references:\s*\[([^\]]*)\]/.exec(rel)?.[1] ?? '')
      .split(',')
      .map((s) => s.trim());
    // The child column names may differ (e.g. activeTenantId); the reference must be [tenantId, id].
    const composite = parts.length === 2 && refs[0] === 'tenantId' && refs[1] === 'id';
    if (!composite) {
      problems.push(`${model.name}.${field.name} -> ${target} must be composite on [tenantId, id]`);
    }
  }
}

fail('check-fk', problems);
