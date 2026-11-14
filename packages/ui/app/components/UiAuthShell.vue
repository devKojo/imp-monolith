<script setup lang="ts">
import UiBreadcrumbs from './UiBreadcrumbs.vue';
import UiSkipLink from './UiSkipLink.vue';

/**
 * Frame for sign-in, sign-up and onboarding screens: breadcrumbs back to where the person came
 * from (or a brand line when none are given), one centred card (title, subtitle,
 * body, account-routing footer strip) and optional text under it. `wide` adds a side column for
 * supporting content on large screens. `layout="split"` is the full-bleed variant for entry pages: the
 * `aside` fills the leading column (stacked above the card on small screens), the card sits in the
 * trailing column as a flat, minimal form (no surface, shadow or footer strip) with a left-aligned
 * heading. It holds no per-user data, so it is safe to server-render.
 */
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    /** Shown only when there are no breadcrumbs. */
    brandName?: string;
    /** Trail back to the public site, e.g. Discover > Sign in. The last item is the current page. */
    breadcrumbs?: Array<{ label: string; to?: string }>;
    size?: 'narrow' | 'wide';
    layout?: 'card' | 'split';
  }>(),
  { size: 'narrow', layout: 'card' },
);
</script>

<template>
  <div class="ui-auth" :data-layout="layout">
    <UiSkipLink />
    <header
      v-if="layout === 'card' && (breadcrumbs?.length || brandName || $slots.brand)"
      class="ui-auth__brand"
    >
      <UiBreadcrumbs v-if="breadcrumbs?.length" :items="breadcrumbs" />
      <slot v-else name="brand">
        <strong class="ui-text-h3">{{ brandName }}</strong>
      </slot>
    </header>
    <main id="main" tabindex="-1" class="ui-auth__main" :data-size="size">
      <aside v-if="(layout === 'split' || size === 'wide') && $slots.aside" class="ui-auth__aside">
        <slot name="aside" />
      </aside>
      <div class="ui-auth__col">
        <UiBreadcrumbs
          v-if="layout === 'split' && breadcrumbs?.length"
          :items="breadcrumbs"
          class="ui-auth__crumbs"
        />
        <section class="ui-auth__card">
          <div class="ui-auth__head">
            <slot name="badge" />
            <h1 class="ui-auth__title ui-text-h1">{{ title }}</h1>
            <p v-if="subtitle" class="ui-auth__subtitle ui-text-body-s">{{ subtitle }}</p>
          </div>
          <div class="ui-auth__body"><slot /></div>
          <div v-if="$slots.footer" class="ui-auth__footer ui-text-body-s">
            <slot name="footer" />
          </div>
        </section>
        <div v-if="$slots.below" class="ui-auth__below ui-text-label-sm"><slot name="below" /></div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.ui-auth {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;
  background: var(--ui-color-surface-page);
}
.ui-auth__brand {
  display: flex;
  justify-content: flex-start;
  padding: var(--ui-space-5) var(--ui-space-6) 0;
}
.ui-auth__main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-12);
  padding: var(--ui-space-6) var(--ui-space-4) var(--ui-space-10);
}
.ui-auth__main:focus {
  outline: none;
}
.ui-auth__col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-6);
  inline-size: 100%;
  max-inline-size: 440px;
}
/* Ambient depth lighting behind the card (decorative). */
.ui-auth__col::before,
.ui-auth__col::after {
  position: absolute;
  z-index: 0;
  border-radius: var(--ui-radius-pill);
  content: '';
  filter: blur(64px);
  pointer-events: none;
}
.ui-auth__col::before {
  inset-block-start: -64px;
  inset-inline-start: 50%;
  inline-size: 320px;
  block-size: 320px;
  background: color-mix(in srgb, var(--ui-color-action-primary) 10%, transparent);
  translate: -50% 0;
}
.ui-auth__col::after {
  inset-block-end: -40px;
  inset-inline-end: 0;
  inline-size: 256px;
  block-size: 256px;
  background: color-mix(in srgb, var(--ui-color-border) 50%, transparent);
}
.ui-auth__main[data-size='wide'] .ui-auth__col {
  max-inline-size: 640px;
}
.ui-auth__aside {
  display: none;
  flex: 1;
  max-inline-size: 480px;
}
@media (min-width: 1024px) {
  .ui-auth__aside {
    display: block;
  }
}
.ui-auth__card {
  position: relative;
  z-index: 1;
  inline-size: 100%;
  overflow: hidden;
  background: var(--ui-color-surface);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-3);
}
.ui-auth__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-8) var(--ui-space-8) 0;
  text-align: center;
}
.ui-auth__head :deep(.ui-badge) {
  margin-block-end: var(--ui-space-3);
}
.ui-auth[data-layout='card'] .ui-auth__title {
  margin: 0;
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: var(--ui-font-display-weight);
  letter-spacing: var(--ui-font-display-tracking);
}
.ui-auth__subtitle {
  margin: 0;
  max-inline-size: 340px;
  color: var(--ui-color-text-secondary);
}
.ui-auth__body {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: var(--ui-space-8);
}
.ui-auth__footer {
  padding: var(--ui-space-5) var(--ui-space-8);
  background: color-mix(in srgb, var(--ui-color-surface-subtle) 60%, var(--ui-color-surface));
  color: var(--ui-color-text-secondary);
  text-align: center;
}
.ui-auth__below {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2) var(--ui-space-4);
  color: var(--ui-color-text-hint);
  text-align: center;
}

/* Split layout: full-bleed entry page (leading panel + a flat form in the trailing column). */
.ui-auth__title {
  margin: 0;
}
.ui-auth[data-layout='split'] .ui-auth__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: 0;
  padding: 0;
}
.ui-auth[data-layout='split'] .ui-auth__aside {
  display: block;
  flex: none;
  max-inline-size: none;
  color: var(--ui-color-text-inverse);
  background: var(--ui-color-surface-inverse);
}
.ui-auth[data-layout='split'] .ui-auth__col {
  align-items: stretch;
  align-self: center;
  justify-self: center;
  gap: var(--ui-space-6);
  max-inline-size: 420px;
  padding: var(--ui-space-8) var(--ui-space-4);
}
.ui-auth[data-layout='split'] .ui-auth__col::before,
.ui-auth[data-layout='split'] .ui-auth__col::after {
  display: none;
}
/* Left-aligned like the rest of the form. */
.ui-auth[data-layout='split'] .ui-auth__below {
  justify-content: flex-start;
  text-align: start;
}
/* Flat: no card surface, shadow or footer strip; the form sits on the page. */
.ui-auth[data-layout='split'] .ui-auth__card {
  overflow: visible;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}
.ui-auth[data-layout='split'] .ui-auth__head {
  align-items: flex-start;
  padding: 0;
  text-align: start;
}
.ui-auth[data-layout='split'] .ui-auth__subtitle,
.ui-auth[data-layout='split'] .ui-auth__footer,
.ui-auth[data-layout='split'] .ui-auth__below {
  font-size: var(--ui-font-caption-size);
  line-height: var(--ui-font-caption-line);
}
.ui-auth[data-layout='split'] .ui-auth__subtitle {
  max-inline-size: none;
}
.ui-auth[data-layout='split'] .ui-auth__body {
  padding: var(--ui-space-6) 0 0;
}
.ui-auth[data-layout='split'] .ui-auth__footer {
  padding: var(--ui-space-6) 0 0;
  background: transparent;
  text-align: start;
}
@media (min-width: 1024px) {
  .ui-auth[data-layout='split'] .ui-auth__main {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
  .ui-auth[data-layout='split'] .ui-auth__col {
    padding: var(--ui-space-12);
    inline-size: 100%;
    max-inline-size: 520px;
  }
}
@media (max-width: 479px) {
  .ui-auth__head {
    padding-inline: var(--ui-space-5);
  }
  .ui-auth__body {
    padding: var(--ui-space-6) var(--ui-space-5);
  }
}
</style>
