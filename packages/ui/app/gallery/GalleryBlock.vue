<script setup lang="ts">
import { computed } from 'vue';
import { composition } from './composition.generated';
import { registry } from './registry';

/**
 * Wraps one component's demo in the gallery with everything a developer needs before reusing it:
 * what it is for, spec references, states, accessibility notes, and what it is built from / used
 * by (derived from source). The workbench rule (UI-GOV-02) is: a component is not "done" until it
 * has a block like this.
 */
const props = defineProps<{ name: string }>();
const entry = computed(() => registry.find((e) => e.name === props.name));
const comp = computed(() => composition[props.name]);
</script>

<template>
  <section :id="name" class="gb" :aria-labelledby="`${name}-h`" data-gallery-block>
    <header class="gb__head">
      <h3 :id="`${name}-h`" class="gb__name ui-text-h3">
        <code>{{ name }}</code>
      </h3>
      <p v-if="entry" class="gb__summary ui-text-body">{{ entry.summary }}</p>
    </header>
    <div class="gb__demo"><slot /></div>
    <dl v-if="entry" class="gb__meta ui-text-body-s">
      <div>
        <dt>States</dt>
        <dd>{{ entry.states.join(' · ') }}</dd>
      </div>
      <div>
        <dt>Accessibility</dt>
        <dd>{{ entry.a11y }}</dd>
      </div>
      <div>
        <dt>Spec</dt>
        <dd>{{ entry.specRefs.join(', ') }}</dd>
      </div>
      <div v-if="comp?.composes.length">
        <dt>Built from</dt>
        <dd>{{ comp.composes.join(', ') }}</dd>
      </div>
      <div v-if="comp?.usedBy.length">
        <dt>Reused by</dt>
        <dd>{{ comp.usedBy.join(', ') }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.gb {
  padding-block: var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.gb__name {
  margin: 0;
}
.gb__summary {
  margin: var(--ui-space-1) 0 var(--ui-space-4);
  color: var(--ui-color-text-secondary);
}
.gb__demo {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: var(--ui-space-4);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.gb__meta {
  display: grid;
  gap: var(--ui-space-1);
  margin: var(--ui-space-3) 0 0;
}
.gb__meta div {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
dt {
  min-inline-size: calc(var(--ui-space-12) * 2);
  font-weight: 600;
  color: var(--ui-color-text-secondary);
}
dd {
  flex: 1;
  margin: 0;
}
</style>
