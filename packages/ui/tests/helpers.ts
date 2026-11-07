import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
// jsdom replaces the global URL class, so avoid fileURLToPath here; import.meta.dirname is plain.
export const uiRoot = `${resolve(import.meta.dirname, '..').replace(/\\/g, '/')}/`;

/** Run one of the package's vite-node scripts and return its exit status and output. */
export function runScript(script: string, ...args: string[]): { ok: boolean; output: string } {
  const bin = require.resolve('vite-node/vite-node.mjs');
  try {
    const out = execFileSync(process.execPath, [bin, `${uiRoot}scripts/${script}`, ...args], {
      cwd: uiRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: out };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}
