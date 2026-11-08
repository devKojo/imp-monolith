// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { staticSiteText as en } from './i18n/staticSiteText';

type Rule = { ssr?: boolean; headers?: Record<string, string>; redirect?: unknown };
let config: { routeRules: Record<string, Rule>; runtimeConfig: { public: Record<string, string> } };

beforeAll(async () => {
  // nuxt.config.ts calls the auto-imported defineNuxtConfig; an identity function is enough here.
  (globalThis as unknown as { defineNuxtConfig: (c: unknown) => unknown }).defineNuxtConfig = (c) =>
    c;
  config = (await import('../nuxt.config')).default as typeof config;
});

describe('route classes (R-WEB-02, R-WEB-05)', () => {
  const cache = (path: string) => config.routeRules[path]?.headers?.['cache-control'];

  it('marketing root redirects to the discovery page', () => {
    expect(config.routeRules['/']?.redirect).toBeTruthy();
  });

  it('the public discovery page is edge-cacheable with the spec headers', () => {
    expect(cache('/discover')).toBe(
      'public, s-maxage=30, stale-while-revalidate=300, stale-if-error=600',
    );
  });

  it.each([
    '/signin',
    '/signup',
    '/check-email',
    '/business/signin',
    '/business/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ])('%s is never cached or shared', (path) => {
    expect(cache(path)).toBe('no-store');
  });

  it('the reset link page never leaks its one-time token in a Referer header', () => {
    const rule = config.routeRules['/reset-password'] as { headers?: Record<string, string> };
    expect(rule.headers?.['referrer-policy']).toBe('no-referrer');
  });

  it('the dashboard is client-rendered (no SSR) and no-store', () => {
    expect(config.routeRules['/app/**']).toMatchObject({ ssr: false });
    expect(cache('/app/**')).toBe('no-store');
  });

  it('no private route is publicly cacheable', () => {
    for (const [path, rule] of Object.entries(config.routeRules)) {
      if (path === '/discover') continue;
      expect(rule.headers?.['cache-control'] ?? '').not.toMatch(/public/);
    }
  });
});

describe('app string catalogue', () => {
  const root = join(__dirname);
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (
        /\.(vue|ts)$/.test(name) &&
        !name.endsWith('.test.ts') &&
        !p.includes(join('i18n', ''))
      )
        files.push(p);
    }
  })(root);

  it('every key used with t() exists', () => {
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g))
        if (!(m[1]! in en)) missing.push(`${f}: ${m[1]}`);
      // template-literal keys such as t(`type.${c.type}.one`): check every possible expansion exists
      for (const m of src.matchAll(/\bt\(\s*`([\w.]+)\$\{[^}]+\}([\w.]*)`/g)) {
        const [prefix, suffix] = [m[1]!, m[2]!];
        const any = Object.keys(en).some((k) => k.startsWith(prefix) && k.endsWith(suffix));
        if (!any) missing.push(`${f}: ${prefix}*${suffix}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('follows the copy rules: no "Tenant", no bare "OK"/"Submit" buttons, no unsupported claims', () => {
    const all = Object.values(en).join('\n');
    expect(all).not.toMatch(/\btenant\b/i);
    expect(Object.values(en)).not.toContain('OK');
    expect(Object.values(en)).not.toContain('Submit');
    // The design reference's marketing claims have no basis in the spec; keep them out of the UI.
    expect(all).not.toMatch(/uptime|ISO 27001|SOC 2|Y Combinator|escrow|cryptographic|\$\d/i);
  });

  it('does not tell users whether an account exists (UI-CPY-03)', () => {
    expect(en['signin.invalid']).not.toMatch(
      /no account|not found|does not exist|already (registered|exists)/i,
    );
    // Signup says so on purpose (EMAIL_TAKEN); sign-in and password reset must not.
    expect(en['forgot.sent']).toMatch(/If \{email\}/);
  });

  it('the dashboard session note matches the 30 minute idle timeout (R-IAM-01)', () => {
    expect(en['signin.sessionNote']).toMatch(/30 minutes/);
  });
});
