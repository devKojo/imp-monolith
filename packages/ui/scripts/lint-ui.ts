/** CLI for the UI lint (rules live in lib/lint-ui.ts so the unit test can import them). */
import { fileURLToPath } from 'node:url';
import { lintDir } from './lib/lint-ui';

const violations = lintDir(fileURLToPath(new URL('../app', import.meta.url)));
if (violations.length > 0) {
  console.error(`FAIL: lint-ui (${violations.length})`);
  for (const v of violations) console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.text}`);
  process.exit(1);
}
console.warn('OK: lint-ui');
