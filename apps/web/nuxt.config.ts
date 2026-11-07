export default defineNuxtConfig({
  // Design tokens, components and the dev-only /ui gallery come from the shared layer.
  extends: ['../../packages/ui'],
  compatibilityDate: '2025-07-15',
  ssr: true,
  typescript: { strict: true },
  runtimeConfig: {
    public: { apiBase: 'http://localhost:3000' }, // override with NUXT_PUBLIC_API_BASE
  },
  devServer: { port: 3001 }, // API uses 3000
  devtools: { enabled: true },
});
