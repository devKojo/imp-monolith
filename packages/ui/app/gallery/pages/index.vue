<script setup lang="ts">
import { computed } from 'vue';
import UiCard from '../../components/UiCard.vue';
import UiLink from '../../components/UiLink.vue';
import { systemStateKinds } from '../../system-states';
import GalleryFrame from '../GalleryFrame.vue';
import { categories, registry } from '../registry';

useHead({ title: 'UI workbench' });
const counts = computed(() =>
  categories.map((c) => ({ category: c, n: registry.filter((e) => e.category === c).length })),
);
</script>

<template>
  <GalleryFrame title="UI workbench" current="/ui">
    <p class="ui-text-body-l ui-reading-left">
      Every component the planned UI/UX needs, with its states, accessibility notes and what it is
      built from. <strong>Look here before building anything new</strong>: most screens are
      compositions of what already exists.
    </p>

    <div class="grid">
      <UiCard title="Foundations" as="section"
        ><p>Tokens, type scale, spacing, contrast results and chart palette.</p>
        <UiLink to="/ui/foundations">Open foundations</UiLink></UiCard
      >
      <UiCard :title="`Components (${registry.length})`" as="section"
        ><p>Every component with live demos and composition.</p>
        <UiLink to="/ui/components">Open components</UiLink></UiCard
      >
      <UiCard :title="`System states (${systemStateKinds.length})`" as="section"
        ><p>The full section 11 matrix: 401, 403, 404, 409, offline and more.</p>
        <UiLink to="/ui/states">Open states</UiLink></UiCard
      >
      <UiCard title="Screens" as="section"
        ><p>Wireframe screens assembled only from library components.</p>
        <UiLink to="/ui/screens">Open screens</UiLink></UiCard
      >
    </div>

    <h2 class="ui-text-h2">Library by category</h2>
    <ul class="cats">
      <li v-for="c in counts" :key="c.category">
        <strong>{{ c.category }}</strong
        >: {{ c.n }}
      </li>
    </ul>

    <h2 class="ui-text-h2">How to use this</h2>
    <ol>
      <li>
        Search the <UiLink to="/ui/components">components page</UiLink> (or
        <code>docs/frontend/component-catalogue.md</code>) for what you need.
      </li>
      <li>Compose existing components first; extend one with a variant before creating another.</li>
      <li>
        If something is genuinely missing, add the component, its registry entry and a gallery demo
        in the same PR (CI enforces this).
      </li>
      <li>
        Read the rules in <code>docs/frontend/README.md</code> and the decisions in
        <code>docs/frontend/adr/</code>.
      </li>
    </ol>
  </GalleryFrame>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 6), 1fr));
  gap: var(--ui-space-4);
  margin-block: var(--ui-space-6);
}
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2) var(--ui-space-6);
  padding: 0;
  list-style: none;
}
.ui-reading-left {
  max-inline-size: var(--ui-layout-reading-column);
}
</style>
