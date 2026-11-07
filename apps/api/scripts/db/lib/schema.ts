import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Field = { name: string; type: string; attrs: string };
export type Model = { name: string; doc: string[]; fields: Field[]; blockAttrs: string[] };

const schemaPath = fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url));

/** Minimal schema.prisma parser: enough for the structural lints (models, fields, doc comments). */
export function parseModels(source = readFileSync(schemaPath, 'utf8')): Model[] {
  const models: Model[] = [];
  let doc: string[] = [];
  let current: Model | undefined;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!current) {
      if (line.startsWith('///')) {
        doc.push(line.slice(3).trim());
      } else if (/^model\s+\w+\s*\{/.test(line)) {
        current = { name: line.split(/\s+/)[1]!, doc, fields: [], blockAttrs: [] };
        doc = [];
      } else if (line !== '' && !line.startsWith('//')) {
        doc = [];
      }
      continue;
    }
    if (line === '}') {
      models.push(current);
      current = undefined;
    } else if (line.startsWith('@@')) {
      current.blockAttrs.push(line);
    } else if (line !== '' && !line.startsWith('//')) {
      const [name, type, ...rest] = line.split(/\s+/);
      if (name && type) current.fields.push({ name, type, attrs: rest.join(' ') });
    }
  }
  return models;
}

export function fail(script: string, problems: string[]): never | void {
  if (problems.length === 0) {
    console.warn(`OK: ${script}`);
    return;
  }
  console.error(`FAIL: ${script}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
}
