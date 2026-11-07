/** R-ARC-04: every Prisma model must carry a `/// @owner <module>` annotation. */
import { fail, parseModels } from './lib/schema';

const problems = parseModels()
  .filter((m) => !m.doc.some((d) => /^@owner\s+[a-z][a-z0-9-]*$/.test(d)))
  .map((m) => `model ${m.name} has no "/// @owner <module>" annotation`);

fail('check-ownership', problems);
