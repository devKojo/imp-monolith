<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiLink from './UiLink.vue';
import UiSelect from './UiSelect.vue';
import UiSkipLink from './UiSkipLink.vue';

/**
 * Public page frame (UI-PUB-01, UI-PUB-23): brand wordmark on top, optional primary navigation and
 * header actions (for example Sign in), a language switcher when there is more than one locale,
 * and a footer that always has Privacy, Terms, Help and Report abuse. The help link is in the same
 * place on every public page. `wide` replaces the 720 px reading column with the full width, so
 * the page owns its sections (listings, landing). Pass `footerColumns` for a link-column footer;
 * without them the footer is a single row of the four required links. Rendered by SSR and
 * edge-cached: it holds no per-user data.
 */
const props = withDefaults(
  defineProps<{
    brandName: string;
    locale?: string;
    locales?: Array<{ value: string; label: string }>;
    links?: { privacy: string; terms: string; help: string; reportAbuse: string };
    /** Full width instead of the reading column. */
    wide?: boolean;
    /** Short line under the brand in the footer. */
    footerTagline?: string;
    /** Link columns in the footer. */
    footerColumns?: Array<{ title: string; links: Array<{ label: string; to: string }> }>;
    /** Copyright line at the bottom of the footer. */
    copyright?: string;
  }>(),
  {
    links: () => ({
      privacy: '/privacy',
      terms: '/terms',
      help: '/help',
      reportAbuse: '/report-abuse',
    }),
  },
);
const emit = defineEmits<{ 'update:locale': [locale: string] }>();
</script>

<template>
  <div class="ui-public">
    <UiSkipLink />
    <header class="ui-public__header">
      <div class="ui-public__brand">
        <slot name="logo">{{ brandName }}</slot>
      </div>
      <nav v-if="$slots.nav" class="ui-public__nav" :aria-label="uiText('nav.primary')">
        <slot name="nav" />
      </nav>
      <div class="ui-public__actions">
        <slot name="actions" />
        <UiSelect
          v-if="locales && locales.length > 1"
          :model-value="props.locale ?? ''"
          :label="uiText('public.language')"
          :options="locales"
          @update:model-value="emit('update:locale', $event)"
        />
      </div>
    </header>
    <main
      id="main"
      tabindex="-1"
      class="ui-public__main"
      :class="wide ? 'ui-public__main--wide' : 'ui-reading'"
    >
      <slot />
    </main>
    <footer class="ui-public__footer" :data-columns="!!footerColumns?.length">
      <div v-if="footerColumns?.length" class="ui-public__footer-top">
        <div class="ui-public__footer-intro">
          <p class="ui-public__footer-brand">{{ brandName }}</p>
          <p v-if="footerTagline" class="ui-public__footer-tagline">{{ footerTagline }}</p>
        </div>
        <nav
          v-for="column in footerColumns"
          :key="column.title"
          class="ui-public__footer-col"
          :aria-label="column.title"
        >
          <h2 class="ui-public__footer-title">{{ column.title }}</h2>
          <ul>
            <li v-for="link in column.links" :key="link.to">
              <UiLink :to="link.to" bare>{{ link.label }}</UiLink>
            </li>
          </ul>
        </nav>
      </div>
      <div class="ui-public__footer-bottom">
        <p v-if="copyright" class="ui-public__copyright">{{ copyright }}</p>
        <p v-else-if="!footerColumns?.length" class="ui-public__footer-brand">{{ brandName }}</p>
        <nav :aria-label="uiText('nav.footer')">
          <ul class="ui-public__legal">
            <li>
              <UiLink :to="links.privacy" bare>{{ uiText('public.privacy') }}</UiLink>
            </li>
            <li>
              <UiLink :to="links.terms" bare>{{ uiText('public.terms') }}</UiLink>
            </li>
            <li>
              <UiLink :to="links.help" bare>{{ uiText('public.help') }}</UiLink>
            </li>
            <li>
              <UiLink :to="links.reportAbuse" bare>{{ uiText('public.reportAbuse') }}</UiLink>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.ui-public {
  /* Compact public density: 36 px controls instead of 44 px. Pages can override per section. */
  --ui-control-target: calc(var(--ui-space-8) + var(--ui-space-1));
  --ui-public-gutter: max(
    var(--ui-space-4),
    calc((100% - var(--ui-layout-content-max)) / 2 + var(--ui-space-8))
  );
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;
}
/* Sticky frosted header: content scrolls underneath it. */
.ui-public__header {
  position: sticky;
  inset-block-start: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2) var(--ui-space-5);
  padding: var(--ui-space-2) var(--ui-public-gutter);
  background: color-mix(in srgb, var(--ui-color-surface-page) 82%, transparent);
  border-block-end: 1px solid var(--ui-color-border);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  backdrop-filter: saturate(180%) blur(16px);
}
.ui-public__brand {
  font-size: var(--ui-font-h3-size);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.ui-public__nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
}
/* Navigation links read as nav items, not inline text links; the current page is marked. */
.ui-public__nav :deep(a) {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-control-target);
  padding-inline: var(--ui-space-3);
  color: var(--ui-color-text-secondary);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-body-s-size);
  font-weight: 500;
  text-decoration: none;
  transition: background var(--ui-motion-fast) ease;
}
.ui-public__nav :deep(a:hover) {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-text-primary);
}
.ui-public__nav :deep(a[aria-current='page']) {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
}
.ui-public__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-inline-start: auto;
}
.ui-public__main {
  flex: 1;
  inline-size: 100%;
  padding: var(--ui-space-4);
}
.ui-public__main--wide {
  max-inline-size: none;
  padding: 0;
}
.ui-public__main:focus {
  outline: none;
}

/* Footer: brand and link columns on top, copyright and legal links underneath. */
.ui-public__footer {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  padding: var(--ui-space-8) var(--ui-public-gutter) var(--ui-space-5);
  background: var(--ui-color-surface-subtle);
  border-block-start: 1px solid var(--ui-color-border);
}
.ui-public__footer[data-columns='false'] {
  padding-block: var(--ui-space-4);
}
.ui-public__footer-top {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--ui-space-12) * 3), 1fr));
  gap: var(--ui-space-6);
}
.ui-public__footer-intro {
  grid-column: 1 / -1;
}
@media (min-width: 768px) {
  .ui-public__footer-top {
    grid-template-columns: 2fr repeat(3, 1fr);
  }
  .ui-public__footer-intro {
    grid-column: auto;
  }
}
.ui-public__footer-brand {
  margin: 0;
  font-size: var(--ui-font-h3-size);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.ui-public__footer-tagline {
  max-inline-size: calc(var(--ui-space-12) * 6);
  margin: var(--ui-space-2) 0 0;
  color: var(--ui-color-text-hint);
  font-size: var(--ui-font-body-s-size);
}
.ui-public__footer-title {
  margin: 0 0 var(--ui-space-3);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-caption-size);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ui-public__footer-col ul {
  flex-direction: column;
  gap: var(--ui-space-2);
}
.ui-public__footer-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2) var(--ui-space-6);
}
.ui-public__footer[data-columns='true'] .ui-public__footer-bottom {
  padding-block-start: var(--ui-space-4);
  border-block-start: 1px solid var(--ui-color-border);
}
.ui-public__copyright {
  margin: 0;
  color: var(--ui-color-text-hint);
  font-size: var(--ui-font-caption-size);
}
ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1) var(--ui-space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}
/* Footer links are quiet text, not default underlined hyperlinks. */
li {
  color: var(--ui-color-text-secondary);
}
li :deep(a) {
  display: inline-block;
  padding-block: var(--ui-space-1);
  font-size: var(--ui-font-body-s-size);
  text-decoration: none;
  transition: color var(--ui-motion-fast) ease;
}
li :deep(a:hover) {
  color: var(--ui-color-action-primary);
}
.ui-public__legal :deep(a) {
  font-size: var(--ui-font-caption-size);
}
</style>
