<script setup lang="ts">
import { computed, ref } from 'vue';
import UiLink from '../../components/UiLink.vue';
import UiTextInput from '../../components/UiTextInput.vue';
import ActionsDemo from '../demos/ActionsDemo.vue';
import DataDemo from '../demos/DataDemo.vue';
import DomainDemo from '../demos/DomainDemo.vue';
import FeedbackDemo from '../demos/FeedbackDemo.vue';
import FormsDemo from '../demos/FormsDemo.vue';
import FoundationDemo from '../demos/FoundationDemo.vue';
import NavigationDemo from '../demos/NavigationDemo.vue';
import OverlaysDemo from '../demos/OverlaysDemo.vue';
import GalleryFrame from '../GalleryFrame.vue';
import { categories, registry } from '../registry';

useHead({ title: 'Components - UI workbench' });

const query = ref('');
const match = (e: (typeof registry)[number]) =>
  `${e.name} ${e.summary} ${e.specRefs.join(' ')}`
    .toLowerCase()
    .includes(query.value.toLowerCase());
const grouped = computed(() =>
  categories
    .map((c) => ({ category: c, items: registry.filter((e) => e.category === c && match(e)) }))
    .filter((g) => g.items.length),
);

const sections = [
  { category: 'Foundation', demo: FoundationDemo },
  { category: 'Actions', demo: ActionsDemo },
  { category: 'Forms', demo: FormsDemo },
  { category: 'Feedback', demo: FeedbackDemo },
  { category: 'Overlays', demo: OverlaysDemo },
  { category: 'Data', demo: DataDemo },
  { category: 'Navigation', demo: NavigationDemo },
  { category: 'Domain', demo: DomainDemo },
] as const;
</script>

<template>
  <GalleryFrame title="Components" current="/ui/components">
    <div class="layout">
      <aside class="toc" aria-label="Component index">
        <UiTextInput
          v-model="query"
          label="Find a component"
          type="search"
          hint="Name, purpose or requirement id"
        />
        <nav>
          <div v-for="g in grouped" :key="g.category">
            <h2 class="ui-text-body-s toc__cat">{{ g.category }}</h2>
            <ul>
              <li v-for="e in g.items" :key="e.name">
                <UiLink :to="`#${e.name}`">{{ e.name }}</UiLink>
              </li>
            </ul>
          </div>
          <p v-if="!grouped.length" class="ui-text-body-s">
            No component matches. Check the catalogue before building a new one.
          </p>
        </nav>
      </aside>
      <div class="content">
        <section v-for="s in sections" :key="s.category" :aria-labelledby="`cat-${s.category}`">
          <h2 :id="`cat-${s.category}`" class="ui-text-h2 cat">{{ s.category }}</h2>
          <component :is="s.demo" />
        </section>
      </div>
    </div>
  </GalleryFrame>
</template>

<style scoped>
.layout {
  display: grid;
  gap: var(--ui-space-6);
}
.toc ul {
  margin: 0 0 var(--ui-space-3);
  padding: 0;
  list-style: none;
}
.toc li a {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-target-dashboard);
}
.toc__cat {
  margin: var(--ui-space-3) 0 var(--ui-space-1);
  font-weight: 700;
  color: var(--ui-color-text-secondary);
}
.cat {
  margin-block: var(--ui-space-8) 0;
  padding-block-end: var(--ui-space-2);
  border-block-end: var(--ui-focus-width) solid var(--ui-color-action-primary);
}
.content {
  min-inline-size: 0;
}
@media (min-width: 1024px) {
  .layout {
    grid-template-columns: calc(var(--ui-space-12) * 5) 1fr;
  }
  .toc {
    position: sticky;
    inset-block-start: var(--ui-space-4);
    align-self: start;
    max-block-size: 90vh;
    overflow: auto;
  }
}
</style>
