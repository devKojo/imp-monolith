<script setup lang="ts">
import { computed } from 'vue';
import UiSystemState from '../../components/UiSystemState.vue';
import { systemStates, systemStateKinds, type SystemStateKind } from '../../system-states';
import GalleryFrame from '../GalleryFrame.vue';

useHead({ title: 'System states - UI workbench' });

// Example values for placeholders in the copy.
const params: Partial<Record<SystemStateKind, Record<string, string>>> = {
  conflict: { status: 'Paused' },
  rateLimited: { time: '0:45' },
  notStarted: { when: '30 Nov at 09:00 GMT' },
  entitlement: { date: '1 Dec' },
};
const rows = computed(() => systemStateKinds.map((kind) => ({ kind, ...systemStates[kind] })));
</script>

<template>
  <GalleryFrame title="System states" current="/ui/states">
    <p class="ui-text-body">
      The section 11 matrix (acceptance UXA-006): every state exists as a component treatment with
      its own wording and next step. Features render
      <code>&lt;UiSystemState kind="..." /&gt;</code> instead of writing their own.
      {{ systemStateKinds.length }} states.
    </p>

    <div class="scroll" role="region" tabindex="0" aria-label="State matrix">
      <table class="ui-text-body-s">
        <thead>
          <tr>
            <th scope="col">State</th>
            <th scope="col">Trigger</th>
            <th scope="col">Treatment</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.kind">
            <th scope="row">
              <a :href="`#state-${r.kind}`">{{ r.kind }}</a>
            </th>
            <td>{{ r.http }}</td>
            <td>{{ r.presentation }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section
      v-for="r in rows"
      :id="`state-${r.kind}`"
      :key="r.kind"
      class="state"
      :aria-label="r.kind"
    >
      <p class="ui-text-caption state__tag">{{ r.kind }} · {{ r.http }} · {{ r.presentation }}</p>
      <UiSystemState :kind="r.kind" :params="params[r.kind]" />
    </section>
  </GalleryFrame>
</template>

<style scoped>
.scroll {
  margin-block: var(--ui-space-4);
  overflow: auto;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
table {
  inline-size: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--ui-space-2) var(--ui-space-3);
  text-align: start;
  border-block-end: 1px solid var(--ui-color-border);
}
.state {
  margin-block: var(--ui-space-4);
  padding: var(--ui-space-3);
  border: 1px dashed var(--ui-color-border-strong);
  border-radius: var(--ui-radius-md);
}
.state__tag {
  margin: 0 0 var(--ui-space-2);
  color: var(--ui-color-text-hint);
}
</style>
