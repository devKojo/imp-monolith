// Rendering and caching per route class (architecture spec 11.2, UI spec 2.3). These are asserted
// by app/config.test.ts so a change cannot silently make a private page cacheable.
const noStore = { 'cache-control': 'no-store' };
const publicEdge = {
  'cache-control': 'public, s-maxage=30, stale-while-revalidate=300, stale-if-error=600',
};

// In development the browser talks only to this origin and Nitro forwards /api/** to the API, which
// mirrors production (CloudFront routes /api/* to the ALB) and keeps __Host- cookies and CSRF
// checks working without CORS. Override the target with API_PROXY_TARGET.
// The default uses 127.0.0.1, not "localhost": Node resolves localhost to ::1 first, and when port
// 3001 is taken (for example by Docker Desktop) Nuxt falls back to port 3000 on ::1. A "localhost"
// target would then point at Nuxt itself, and every /api request would hang.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000/api/';

export default defineNuxtConfig({
  // Design tokens, components and the dev-only /ui gallery come from the shared layer.
  extends: ['../../packages/ui'],
  compatibilityDate: '2025-07-15',
  ssr: true,
  typescript: { strict: true },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000', // override with NUXT_PUBLIC_API_BASE
      // 'sample' shows labelled example campaigns; 'api' calls GET /api/v1/public/campaigns.
      discoverySource: process.env.NODE_ENV === 'production' ? 'api' : 'sample',
    },
  },
  routeRules: {
    '/': { redirect: { to: '/discover', statusCode: 302 } },
    // Public and cacheable: no cookies, no per-user data.
    '/discover': { headers: publicEdge },
    // Authentication pages must never be cached or shared.
    '/signin': { headers: noStore },
    '/signup': { headers: noStore },
    '/check-email': { headers: noStore },
    '/business/signin': { headers: noStore },
    '/business/register': { headers: noStore },
    '/verify-email': { headers: noStore },
    // Dashboard: client-rendered so private data never passes through the SSR tier.
    '/app/**': { ssr: false, headers: noStore },
    '/me/**': { ssr: false, headers: noStore },
  },
  nitro: {
    devProxy: { '/api/': { target: apiProxyTarget, changeOrigin: true } },
  },
  devServer: { port: 3001 }, // API uses 3000
  devtools: { enabled: true },
});
