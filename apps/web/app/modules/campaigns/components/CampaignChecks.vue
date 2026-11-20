<script setup lang="ts">
import { computed } from 'vue';
import { t, type AppTextKey } from '../../../i18n';
import type { ContentDetail } from '../logic';
import type { PreflightCheck } from '../types';

/**
 * What still stands between this campaign and launching, computed from the campaign itself. A check that
 * fails on content says what is missing (how many to add, or how many are unfinished), not only that it fails.
 */
const props = defineProps<{ checks: PreflightCheck[]; contentDetail?: ContentDetail | null }>();
const detailText = (d: ContentDetail) =>
  t(`cmp.check.content.${d.kind}.${d.candidates ? 'candidate' : 'other'}` as AppTextKey, {
    n: d.n,
    have: d.have,
  });
const passed = computed(() => props.checks.filter((c) => c.pass).length);
</script>

<template>
  <UiCard as="section" aria-labelledby="campaign-checks-title" class="checks">
    <h2 id="campaign-checks-title" class="ui-text-h3">{{ t('cmp.checks') }}</h2>
    <p class="ui-text-caption ui-text-hint" role="status">
      {{ t('cmp.checks.summary', { pass: passed, total: checks.length }) }}
    </p>
    <ul class="checks__list">
      <li v-for="c in checks" :key="c.id" class="check" :data-pass="c.pass">
        <UiIcon :name="c.pass ? 'check-circle' : 'alert-triangle'" :size="18" />
        <span class="ui-text-body-s">
          {{ t(`cmp.check.${c.id}` as AppTextKey) }}
          <span v-if="c.id === 'content' && !c.pass && contentDetail" class="check__detail">
            {{ detailText(contentDetail) }}
          </span>
        </span>
      </li>
    </ul>
  </UiCard>
</template>

<style scoped>
.checks {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.checks h2,
.checks p {
  margin: 0;
}
.checks__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.check {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-color-warning-text);
}
.check__detail {
  display: block;
  font-weight: 600;
}
.check[data-pass='true'] {
  color: var(--ui-color-success-text);
}
</style>
