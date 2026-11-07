/** R-DAT-05: sum(replicas x poolMax) must not exceed 70% of the pooler/database connection limit. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fail } from './lib/schema';

type Budget = {
  maxConnections: number;
  profiles: Array<{ name: string; replicas: number; poolMax: number }>;
};
const budget = JSON.parse(
  readFileSync(fileURLToPath(new URL('./connection-budget.json', import.meta.url)), 'utf8'),
) as Budget;

const used = budget.profiles.reduce((sum, p) => sum + p.replicas * p.poolMax, 0);
const allowed = Math.floor(budget.maxConnections * 0.7);
console.warn(`connections: ${used} planned / ${allowed} allowed (70% of ${budget.maxConnections})`);

fail('connection-budget', used > allowed ? [`planned ${used} exceeds allowed ${allowed}`] : []);
