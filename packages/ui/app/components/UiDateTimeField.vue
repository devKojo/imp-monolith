<script setup lang="ts">
import { computed, useId } from 'vue';
import { uiText } from '../composables/useUiText';
import { formatInZone, zonedToInstant } from '../utils/datetime';
import UiIcon from './UiIcon.vue';

export type DateTimeValue = { date: string; time: string; zone: string };

/**
 * Date, time and time zone as three typeable native fields (no calendar-only entry). The zone
 * defaults to the business zone, and the participant-facing time is always shown with its zone
 * abbreviation (UI-BLD-04, UI-I18N-03).
 */
const props = defineProps<{
  modelValue: DateTimeValue;
  legend: string;
  zones?: string[];
  error?: string;
  hint?: string;
  /** The visitor's zone: when different, their local time is shown too. */
  visitorZone?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: DateTimeValue] }>();
const id = useId();
const set = (patch: Partial<DateTimeValue>) =>
  emit('update:modelValue', { ...props.modelValue, ...patch });

const zoneList = computed(() =>
  props.zones?.includes(props.modelValue.zone)
    ? props.zones
    : [props.modelValue.zone, ...(props.zones ?? [])],
);

const preview = computed(() => {
  const instant = zonedToInstant(
    props.modelValue.date,
    props.modelValue.time,
    props.modelValue.zone,
  );
  if (!instant) return '';
  let text = formatInZone(instant, props.modelValue.zone);
  if (props.visitorZone && props.visitorZone !== props.modelValue.zone) {
    text += ` (${formatInZone(instant, props.visitorZone)})`;
  }
  return uiText('datetime.participantsSee', { value: text });
});
</script>

<template>
  <fieldset class="ui-dt" :aria-describedby="error ? `${id}-e` : hint ? `${id}-h` : undefined">
    <legend class="ui-dt__legend">{{ legend }}</legend>
    <div class="ui-dt__row">
      <label class="ui-dt__part">
        <span>{{ uiText('datetime.date') }}</span>
        <input
          class="ui-control"
          type="date"
          :value="modelValue.date"
          :aria-invalid="error ? 'true' : undefined"
          @input="set({ date: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="ui-dt__part">
        <span>{{ uiText('datetime.time') }}</span>
        <input
          class="ui-control"
          type="time"
          :value="modelValue.time"
          :aria-invalid="error ? 'true' : undefined"
          @input="set({ time: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="ui-dt__part">
        <span>{{ uiText('datetime.zone') }}</span>
        <select
          class="ui-control"
          :value="modelValue.zone"
          @change="set({ zone: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="z in zoneList" :key="z" :value="z">{{ z }}</option>
        </select>
      </label>
    </div>
    <p v-if="preview" class="ui-dt__preview ui-text-body-s" aria-live="polite">{{ preview }}</p>
    <p v-if="error" :id="`${id}-e`" class="ui-dt__error ui-text-body-s">
      <UiIcon name="alert-circle" :size="16" /> {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-h`" class="ui-text-body-s ui-text-hint ui-dt__note">
      {{ hint }}
    </p>
  </fieldset>
</template>

<style scoped>
.ui-dt {
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}
.ui-dt__legend {
  padding: 0;
  margin-block-end: var(--ui-space-1);
  font-weight: 600;
  color: var(--ui-color-text-secondary);
}
.ui-dt__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3);
}
.ui-dt__part {
  display: flex;
  flex: 1 1 calc(var(--ui-space-12) * 3);
  flex-direction: column;
  gap: var(--ui-space-1);
  color: var(--ui-color-text-secondary);
}
.ui-dt__preview {
  margin: var(--ui-space-2) 0 0;
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-color-info-bg);
  color: var(--ui-color-info-text);
  border-radius: var(--ui-radius-sm);
}
.ui-dt__error {
  display: flex;
  gap: var(--ui-space-1);
  margin: var(--ui-space-1) 0 0;
  color: var(--ui-color-danger-text);
}
.ui-dt__note {
  margin: var(--ui-space-1) 0 0;
}
</style>
