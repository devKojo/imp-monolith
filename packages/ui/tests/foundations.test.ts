import { describe, expect, it } from 'vitest';
import tokenSource from '../tokens/tokens.json';
import { contrastRatio } from '../scripts/lib/contrast';
import { lintDir, lintSource } from '../scripts/lib/lint-ui';
import { en } from '../app/i18n/en';
import { systemStateKinds } from '../app/system-states';
import { stateKey } from '../app/system-states';
import { runScript, uiRoot } from './helpers';

const raw = tokenSource.raw as Record<string, string>;
const semantic = tokenSource.semantic as Record<string, string>;
const hex = (name: string) => raw[semantic[name] ?? name]!;

describe('design tokens (UXA-003)', () => {
  it('every contrast pair meets its threshold, or carries a documented waiver', () => {
    for (const p of tokenSource.contrast) {
      const ratio = contrastRatio(hex(p.fg), hex(p.bg));
      const floor = 'waiver' in p ? (p.waiver as { min: number }).min : p.min;
      expect(ratio, `${p.fg} on ${p.bg} (${p.use})`).toBeGreaterThanOrEqual(floor);
    }
  });

  it('keeps waivers rare and justified', () => {
    const waived = tokenSource.contrast.filter((p) => 'waiver' in p);
    expect(waived.length).toBeLessThanOrEqual(1);
    for (const p of waived)
      expect((p as { waiver: { reason: string } }).waiver.reason).toMatch(/ADR-F004/);
  });

  it('reproduces the contrast values published in the UI spec', () => {
    expect(contrastRatio('#101828', '#FFFFFF')).toBeCloseTo(17.75, 1);
    expect(contrastRatio('#FFFFFF', '#1D4ED8')).toBeCloseTo(6.7, 1);
    expect(contrastRatio('#B42318', '#FEF3F2')).toBeCloseTo(6.05, 1);
  });

  it('generated CSS and TypeScript are up to date', () => {
    const r = runScript('build-tokens.ts', '--check');
    expect(r.ok, r.output).toBe(true);
  });

  it('exposes the spacing, radius and breakpoint scales from the spec', () => {
    expect(tokenSource.space).toMatchObject({ '1': 4, '4': 16, '12': 48 });
    // Softer, larger radii for the startup look (ADR-F014).
    expect(tokenSource.radius).toMatchObject({ sm: 6, md: 10, lg: 14, xl: 20 });
    expect(tokenSource.breakpoint).toMatchObject({ md: 768, lg: 1024 });
    expect(tokenSource.target).toMatchObject({ public: 44, dashboard: 32, minimum: 24 });
  });
});

describe('ui lint (UI-FND-01, UI-FND-03)', () => {
  it('rejects hard-coded colours, sizes, spacing and physical properties', () => {
    const bad = lintSource(
      'x.vue',
      '<style scoped>\n.a { color: #fff; font-size: 14px; margin-left: 8px; padding: 12px; }\n.b { background: rgb(0,0,0); }\n</style>',
    );
    const rules = new Set(bad.map((v) => v.rule));
    expect(rules).toEqual(
      new Set([
        'no-hardcoded-colour',
        'no-hardcoded-font-size',
        'logical-properties',
        'no-hardcoded-spacing',
      ]),
    );
  });

  it('rejects v-html, long transitions and unscoped styles', () => {
    expect(lintSource('x.vue', '<div v-html="x" />').map((v) => v.rule)).toContain('no-v-html');
    expect(
      lintSource('x.vue', '<style scoped>\n.a { transition: opacity 400ms; }\n</style>').map(
        (v) => v.rule,
      ),
    ).toContain('transition-duration');
    expect(
      lintSource('x.vue', '<style>\n.a { color: var(--ui-color-link); }\n</style>').map(
        (v) => v.rule,
      ),
    ).toContain('scoped-styles');
  });

  it('accepts token-based CSS and ignores comments', () => {
    const ok = lintSource(
      'x.vue',
      '<style scoped>\n/* #fff margin-left: 4px */\n.a { color: var(--ui-color-link); padding: var(--ui-space-4); border: 1px solid var(--ui-color-border); }\n</style>',
    );
    expect(ok).toEqual([]);
  });

  it('the whole library is clean', () => {
    expect(lintDir(`${uiRoot}app`)).toEqual([]);
  });
});

describe('string catalogue (UI-CPY-05) and system states (UXA-006)', () => {
  it('every key used by a component exists in the catalogue', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = `${uiRoot}app/components/`;
    const missing: string[] = [];
    for (const f of readdirSync(dir)) {
      const src = readFileSync(`${dir}${f}`, 'utf8');
      for (const m of src.matchAll(/uiText\('([\w.]+)'/g))
        if (!(m[1]! in en)) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('every system state has a title and body in the catalogue', () => {
    expect(systemStateKinds.length).toBeGreaterThanOrEqual(19);
    for (const kind of systemStateKinds) {
      expect(en, `${kind} title`).toHaveProperty(stateKey(kind, 'title'));
      expect(en, `${kind} body`).toHaveProperty(stateKey(kind, 'body'));
    }
  });

  it('follows the copy rules: no "Tenant", no bare OK/Submit buttons', () => {
    const all = Object.values(en).join('\n');
    expect(all).not.toMatch(/\btenant\b/i);
    for (const label of ['OK', 'Submit']) expect(Object.values(en)).not.toContain(label);
  });
});
