import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Components import everything from 'vue' explicitly (no Nuxt auto-imports) so they can be mounted
// in isolation here. Nuxt-only pieces (NuxtLink) are stubbed in tests/setup.ts.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
  },
});
