<script setup lang="ts">
import { t } from '../../../i18n';
import type { MyParticipation } from '../useMyParticipations';

/**
 * "My participation" on the participant hub: one row per quiz attempt or survey response, newest
 * first. A campaign with a public address links back to its page.
 */
defineProps<{
  items: MyParticipation[];
  total: number;
  pageSize: number;
  /** The next page is loading; the current rows stay visible but dimmed. */
  busy?: boolean;
}>();
const page = defineModel<number>('page', { default: 1 });

const dateOf = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));

function result(p: MyParticipation): string | null {
  if (p.kind !== 'quiz' || p.score === null || p.total === null) return null;
  return t('me.participations.score', { score: p.score, total: p.total });
}
</script>

<template>
  <section class="mine" aria-labelledby="mine-title" :aria-busy="busy">
    <h2 id="mine-title" class="ui-text-h2">{{ t('me.participations.title') }}</h2>
    <ul class="mine__list" :data-busy="busy">
      <li v-for="(p, i) in items" :key="`${p.campaignId}-${p.startedAt}-${i}`">
        <UiCard class="mine__row">
          <div class="mine__main">
            <UiLink v-if="p.slug" :to="`/c/${p.slug}`" class="mine__title">{{ p.title }}</UiLink>
            <span v-else class="mine__title">{{ p.title }}</span>
            <span class="mine__meta ui-text-caption">
              {{ t(p.kind === 'quiz' ? 'type.quiz.one' : 'type.survey.one') }} ·
              {{ dateOf(p.submittedAt ?? p.startedAt) }}
              <template v-if="result(p)"> · {{ result(p) }}</template>
            </span>
          </div>
          <div class="mine__badges">
            <UiBadge v-if="p.passed !== null" :tone="p.passed ? 'success' : 'warning'">
              {{ t(p.passed ? 'me.participations.passed' : 'me.participations.notPassed') }}
            </UiBadge>
            <UiBadge :tone="p.status === 'completed' ? 'success' : 'info'">
              {{
                t(
                  p.status === 'completed'
                    ? 'me.participations.completed'
                    : 'me.participations.inProgress',
                )
              }}
            </UiBadge>
          </div>
        </UiCard>
      </li>
    </ul>
    <UiPagination
      v-model:page="page"
      :total="total"
      :page-size="pageSize"
      always-show-controls
      :label="t('me.participations.title')"
    />
  </section>
</template>

<style scoped>
.mine {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.mine__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.mine__list[data-busy='true'] {
  opacity: 0.6;
}
.mine__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.mine__main {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  min-inline-size: 0;
}
.mine__title {
  font-weight: 600;
}
.mine__meta {
  color: var(--ui-color-text-secondary);
}
.mine__badges {
  display: flex;
  gap: var(--ui-space-2);
}
</style>
