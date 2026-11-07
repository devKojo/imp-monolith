/**
 * UI lint (UI-FND-01, UI-FND-03, UI-FND-07, UI-A11Y-04 subset). Components must consume semantic
 * tokens only. Rejected:
 *   - hard-coded colours (hex, rgb(), hsl()) outside the generated tokens
 *   - hard-coded font sizes and spacing (margin, padding, gap, inset) in px / rem / em
 *   - physical left/right properties (use logical start/end, UI-FND-03)
 *   - transitions longer than 200 ms (UI-FND-07)
 *   - v-html (R-WEB-06) and unscoped component styles
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Violation = { file: string; line: number; rule: string; text: string };

const rules: Array<{ id: string; test: RegExp; message: string }> = [
  {
    id: 'no-hardcoded-colour',
    test: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/,
    message: 'Use a semantic colour token (var(--ui-color-*)).',
  },
  {
    id: 'no-hardcoded-font-size',
    test: /font-size\s*:\s*[\d.]+(px|rem|em)\b/,
    message: 'Use a font token (var(--ui-font-*-size)).',
  },
  {
    id: 'no-hardcoded-spacing',
    test: /\b(margin|padding|gap|row-gap|column-gap|inset)[\w-]*\s*:[^;{}]*?(?<![\w-])[1-9][\d.]*(px|rem|em)\b/,
    message: 'Use a spacing token (var(--ui-space-*)).',
  },
  {
    id: 'logical-properties',
    test: /\b(margin|padding|border)-(left|right)\b|(?<![\w-])(left|right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)/,
    message: 'Use logical properties (inline-start/end, UI-FND-03).',
  },
  {
    id: 'transition-duration',
    test: /transition[^;]*?\b(?:[3-9]\d{2}|\d{4,})ms\b/,
    message: 'Transitions must be 200 ms or less (UI-FND-07).',
  },
  {
    id: 'no-v-html',
    test: /\bv-html\b/,
    message: 'v-html is prohibited; render from the sanitised block model.',
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(vue|css)$/.test(name) && !name.endsWith('tokens.css')) out.push(p);
  }
  return out;
}

export function lintSource(file: string, source: string): Violation[] {
  const found: Violation[] = [];
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  stripped.split('\n').forEach((text, i) => {
    for (const r of rules)
      if (r.test.test(text)) found.push({ file, line: i + 1, rule: r.id, text: text.trim() });
  });
  if (file.endsWith('.vue') && /<style\b/.test(source) && !/<style[^>]*\bscoped\b/.test(source)) {
    found.push({
      file,
      line: 1,
      rule: 'scoped-styles',
      text: 'Component styles must be <style scoped>.',
    });
  }
  return found;
}

export function lintDir(dir: string): Violation[] {
  return walk(dir).flatMap((f) => lintSource(f, readFileSync(f, 'utf8')));
}
