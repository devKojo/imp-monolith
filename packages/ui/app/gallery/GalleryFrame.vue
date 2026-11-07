<script setup lang="ts">
import UiLink from '../components/UiLink.vue';
import UiSkipLink from '../components/UiSkipLink.vue';
import UiToaster from '../components/UiToaster.vue';

/** Frame for gallery pages: skip link, section navigation, one main landmark, toaster for demos. */
defineProps<{ title: string; current: string }>();

const sections = [
  { to: '/ui', label: 'Overview' },
  { to: '/ui/foundations', label: 'Foundations' },
  { to: '/ui/components', label: 'Components' },
  { to: '/ui/states', label: 'System states' },
  { to: '/ui/screens', label: 'Screens' },
];
</script>

<template>
  <UiToaster>
    <UiSkipLink />
    <header class="gf__head">
      <p class="gf__brand ui-text-body-s">UI workbench (development only)</p>
      <nav aria-label="Gallery sections">
        <ul>
          <li v-for="s in sections" :key="s.to">
            <UiLink :to="s.to" :aria-current="s.to === current ? 'page' : undefined">{{
              s.label
            }}</UiLink>
          </li>
        </ul>
      </nav>
    </header>
    <main id="main" tabindex="-1" class="gf__main">
      <h1 class="ui-text-h1">{{ title }}</h1>
      <slot />
    </main>
  </UiToaster>
</template>

<style scoped>
.gf__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-color-surface-subtle);
  border-block-end: 1px solid var(--ui-color-border);
}
.gf__brand {
  margin: 0;
  font-weight: 700;
}
ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2) var(--ui-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
li a {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-target-dashboard);
}
li a[aria-current='page'] {
  font-weight: 700;
  text-decoration: none;
}
.gf__main {
  max-inline-size: var(--ui-layout-content-max);
  margin-inline: auto;
  padding: var(--ui-space-4);
}
.gf__main:focus {
  outline: none;
}
</style>
