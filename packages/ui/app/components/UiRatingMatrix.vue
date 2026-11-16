<script setup lang="ts">
import { useId } from 'vue';

/**
 * Statements rated on one shared scale (the survey "matrix"): a row per statement and a native radio per
 * scale point, so arrow keys move within a row and every row has its own answer. Number keys pick that
 * point for the focused row (1 is the first scale label). On a wide screen the scale labels sit once in the
 * header; on a narrow one each radio carries its own label so nothing depends on a header out of view.
 * The page owns the answers and the saving.
 */
const props = defineProps<{
  /** Accessible name of the whole matrix (the question). */
  legend: string;
  /** Header of the statements column. */
  statementLabel: string;
  /** Scale labels in order, from lowest to highest. */
  scale: string[];
  rows: Array<{ id: string; label: string }>;
  /** Row id to the chosen scale index; a row without an answer is missing. */
  modelValue: Readonly<Record<string, number | undefined>>;
  /** Set for every row that must be answered, so assistive tech announces it. */
  required?: boolean;
}>();

const emit = defineEmits<{ select: [rowId: string, index: number] }>();
const uid = useId();

function onKey(e: KeyboardEvent, rowId: string) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const n = Number(e.key);
  if (Number.isInteger(n) && n >= 1 && n <= props.scale.length) {
    e.preventDefault();
    emit('select', rowId, n - 1);
  }
}
</script>

<template>
  <div class="ui-matrix" role="group" :aria-label="legend" :style="{ '--cols': scale.length }">
    <div class="ui-matrix__head ui-text-label-sm" aria-hidden="true">
      <span>{{ statementLabel }}</span>
      <span v-for="s in scale" :key="s" class="ui-matrix__scale">{{ s }}</span>
    </div>
    <div
      v-for="row in rows"
      :key="row.id"
      class="ui-matrix__row"
      role="radiogroup"
      :aria-labelledby="`${uid}-${row.id}`"
      :aria-required="required ? 'true' : undefined"
    >
      <p :id="`${uid}-${row.id}`" class="ui-matrix__statement ui-text-body">{{ row.label }}</p>
      <label
        v-for="(s, i) in scale"
        :key="s"
        class="ui-matrix__cell"
        :data-checked="modelValue[row.id] === i"
      >
        <input
          type="radio"
          :name="`${uid}-${row.id}`"
          :value="i"
          :checked="modelValue[row.id] === i"
          @change="emit('select', row.id, i)"
          @keydown="onKey($event, row.id)"
        />
        <span class="ui-matrix__dot" aria-hidden="true" />
        <span class="ui-matrix__name ui-text-label-sm">{{ s }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.ui-matrix {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
}
.ui-matrix__head {
  display: none;
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-text-secondary);
}
.ui-matrix__scale {
  text-align: center;
}
.ui-matrix__row {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: var(--ui-space-2);
  padding: var(--ui-space-4);
  border-block-start: 1px solid var(--ui-color-border);
}
.ui-matrix__row:first-of-type {
  border-block-start: 0;
}
.ui-matrix__statement {
  grid-column: 1 / -1;
  margin: 0;
}
.ui-matrix__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-1);
  min-block-size: var(--ui-target-public);
  padding: var(--ui-space-2);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  text-align: center;
}
.ui-matrix__cell[data-checked='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
}
.ui-matrix__cell input {
  position: absolute;
  opacity: 0;
  inline-size: 1px;
  block-size: 1px;
}
.ui-matrix__dot {
  inline-size: var(--ui-space-5);
  block-size: var(--ui-space-5);
  border: 2px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-surface);
}
.ui-matrix__cell[data-checked='true'] .ui-matrix__dot {
  border-color: var(--ui-color-action-primary);
  background: var(--ui-color-action-primary);
  box-shadow: inset 0 0 0 var(--ui-space-1) var(--ui-color-surface);
}
.ui-matrix__cell:has(input:focus-visible) {
  outline: var(--ui-focus-width) solid var(--ui-color-focus-ring);
  outline-offset: var(--ui-focus-offset);
}
.ui-matrix__name {
  overflow-wrap: anywhere;
}
@media (min-width: 48rem) {
  .ui-matrix__head {
    display: grid;
    grid-template-columns: minmax(0, 2fr) repeat(var(--cols), minmax(0, 1fr));
    gap: var(--ui-space-2);
    align-items: center;
  }
  .ui-matrix__row {
    grid-template-columns: minmax(0, 2fr) repeat(var(--cols), minmax(0, 1fr));
    align-items: center;
  }
  .ui-matrix__statement {
    grid-column: auto;
  }
  /* The header names the scale; the radio keeps its label for assistive tech only. */
  .ui-matrix__name {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
