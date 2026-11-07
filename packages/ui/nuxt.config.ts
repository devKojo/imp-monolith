import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * @imp/ui is a Nuxt layer (UI-FND-02): tokens, components and composables are auto-registered in
 * any app that `extends` it. The gallery pages are NOT part of the layer's normal routes; they are
 * added only in dev or when UI_GALLERY=1, so they never ship to production by accident
 * (ADR-F005).
 */
export default defineNuxtConfig({
  css: [here('./app/assets/css/tokens.css'), here('./app/assets/css/base.css')],
  components: [{ path: here('./app/components'), pathPrefix: false }],
  hooks: {
    'pages:extend'(pages) {
      const enabled = process.env.NODE_ENV !== 'production' || process.env.UI_GALLERY === '1';
      if (!enabled) return;
      for (const [path, file] of [
        ['/ui', 'index.vue'],
        ['/ui/foundations', 'foundations.vue'],
        ['/ui/components', 'components.vue'],
        ['/ui/states', 'states.vue'],
        ['/ui/screens', 'screens.vue'],
      ] as const) {
        pages.push({
          name: `ui-gallery-${file.replace('.vue', '')}`,
          path,
          file: here(`./app/gallery/pages/${file}`),
        });
      }
    },
  },
});
