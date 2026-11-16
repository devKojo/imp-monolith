<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../../i18n';
import type { PublicCampaignPage, QuizInfo } from '../../quiz/types';
import type { SurveyInfo } from '../../survey/types';
import { winnersLabelKey } from '../logic';
import { canEnter, timeLeft, totalWinners } from '../publicPage';
import ShareCampaign from './ShareCampaign.vue';

/**
 * The public page of a campaign (/c/{slug}), built from what the campaign itself says: its kind sets
 * the wording and the call to action, the prizes become the prize section, the schedule becomes the
 * countdown, and a quiz adds its rules. Sections the campaign has no content for are left out, so two
 * campaigns never look like the same template with the same placeholders. Structure follows the
 * campaign page design; it claims nothing the campaign does not say. The page that owns the data
 * decides the visitor's standing and what the button does.
 */
const props = defineProps<{
  campaign: PublicCampaignPage;
  info: QuizInfo | null;
  /** The facts of a survey campaign; null for any other kind. */
  survey: SurveyInfo | null;
  /** Label of the main action, or empty when this visitor cannot enter (for example a business account). */
  actionLabel: string;
  /** Where the action goes when the visitor is not signed in; otherwise the action is a click. */
  actionTo: string | null;
  starting: boolean;
  problem: string;
  /** The visitor is signed in as a business, which cannot take part. */
  businessAccount: boolean;
  zone: string;
}>();
const emit = defineEmits<{ action: [] }>();

// ---- countdown: one tick a second, client only; assistive tech reads the closing time, not the ticks
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)));
onBeforeUnmount(() => timer && clearInterval(timer));

const left = computed(() => timeLeft(props.campaign.endsAt, now.value));
const units = computed(() => {
  const l = left.value;
  if (!l) return [];
  return [
    { key: 'days', value: l.days, label: t('pub.unit.days') },
    { key: 'hours', value: l.hours, label: t('pub.unit.hours') },
    { key: 'minutes', value: l.minutes, label: t('pub.unit.minutes') },
    { key: 'seconds', value: l.seconds, label: t('pub.unit.seconds') },
  ];
});
const closes = computed(() =>
  t('quiz.rules.ends', { date: formatInZone(new Date(props.campaign.endsAt), props.zone) }),
);
const started = computed(
  () => !props.campaign.startsAt || new Date(props.campaign.startsAt).getTime() <= now.value,
);

// ---- wording that depends on the kind of campaign
const kind = computed(() => props.campaign.type);
const kicker = computed(() => t(`type.${kind.value}.one` as AppTextKey));
const tagline = computed(() => t(`pub.tagline.${kind.value}` as AppTextKey));
const intro = computed(() => props.campaign.summary || tagline.value);
const enterable = computed(() => canEnter(kind.value));

// ---- prizes
const tiers = computed(() => props.campaign.prizes);
const top = computed(() => tiers.value[0] ?? null);
const topValue = computed(() => top.value?.valueLabel || top.value?.name || '');
const winnersText = (n: number) => t(winnersLabelKey(n), { n });
const prizeSummary = computed(() =>
  t('pub.prizes.total', { n: totalWinners(tiers.value), tiers: tiers.value.length }),
);

// ---- details: what a participant should know before starting
const details = computed(() => {
  const s = props.survey;
  if (s) {
    return [
      t('survey.rules.questions', { n: s.questionCount }),
      t('survey.rules.time', { n: s.estimatedMinutes }),
      ...(s.requiredCount > 0 ? [t('survey.rules.required', { n: s.requiredCount })] : []),
    ];
  }
  const i = props.info;
  if (!i) return [];
  return [
    t('quiz.rules.questions', { n: i.questionCount }),
    i.timeLimitMinutes ? t('quiz.rules.time', { n: i.timeLimitMinutes }) : t('quiz.rules.untimed'),
    t('quiz.rules.pass', { n: i.passPercent }),
  ];
});
const questionCount = computed(
  () => props.survey?.questionCount ?? props.info?.questionCount ?? null,
);
const ready = computed(
  () => enterable.value && questionCount.value !== null && questionCount.value > 0,
);
const isSurvey = computed(() => kind.value === 'survey');
const hasSections = computed(() => ({
  prizes: tiers.value.length > 0,
  details: details.value.length > 0,
}));
</script>

<template>
  <article class="view" aria-labelledby="campaign-title">
    <div class="bar">
      <p class="bar__label ui-text-label-sm">
        <span class="bar__dot" aria-hidden="true" />
        {{
          started
            ? t('pub.closesIn')
            : t('pub.opensOn', {
                date: formatInZone(new Date(campaign.startsAt ?? campaign.endsAt), zone),
              })
        }}
      </p>
      <p v-if="units.length > 0" class="bar__time" aria-hidden="true">
        <span v-for="u in units" :key="u.key" class="unit">
          <strong>{{ String(u.value).padStart(2, '0') }}</strong>
          <span class="ui-text-label-sm">{{ u.label }}</span>
        </span>
      </p>
      <p v-else class="ui-text-label">{{ t('pub.closed') }}</p>
      <p class="ui-sr-only">{{ closes }}</p>
      <p class="bar__ends ui-text-caption">{{ closes }}</p>
    </div>

    <section class="hero">
      <div class="hero__copy">
        <p class="chips">
          <UiBadge tone="success" shape="pill">{{ t('pub.live') }}</UiBadge>
          <UiBadge tone="info" shape="pill">{{ kicker }}</UiBadge>
        </p>
        <h1 id="campaign-title" class="ui-text-display">{{ campaign.title }}</h1>
        <p class="by ui-text-caption ui-text-hint">
          {{ t('quiz.by', { business: campaign.businessName }) }}
        </p>
        <p class="intro ui-text-body-l">{{ intro }}</p>

        <ul v-if="details.length > 0" class="facts">
          <li v-for="d in details" :key="d">
            <UiBadge shape="pill">{{ d }}</UiBadge>
          </li>
        </ul>

        <UiBanner v-if="questionCount === 0" tone="info">
          {{ isSurvey ? t('survey.empty') : t('quiz.empty') }}
        </UiBanner>
        <UiBanner v-else-if="!enterable" tone="info">{{ t('quiz.notQuiz') }}</UiBanner>
        <UiBanner v-else-if="businessAccount" tone="info">{{ t('quiz.businessAccount') }}</UiBanner>
        <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

        <div v-if="ready && !businessAccount" class="actions">
          <UiButton v-if="actionTo" :to="actionTo" size="lg" icon-trailing="arrow-right">
            {{ actionLabel }}
          </UiButton>
          <UiButton
            v-else
            size="lg"
            icon-trailing="arrow-right"
            :loading="starting"
            :loading-label="t('quiz.saving')"
            @click="emit('action')"
          >
            {{ actionLabel }}
          </UiButton>
          <ShareCampaign :slug="campaign.slug" :title="campaign.title" variant="secondary" />
        </div>
        <div v-else class="actions">
          <ShareCampaign :slug="campaign.slug" :title="campaign.title" variant="secondary" />
        </div>
        <p v-if="ready && actionTo" class="ui-text-caption ui-text-hint">
          {{ isSurvey ? t('survey.signin.hint') : t('quiz.signin.hint') }}
        </p>
      </div>

      <aside v-if="top" class="hero__prize" :aria-label="t('pub.top.label')">
        <UiIcon name="trophy" :size="32" />
        <p class="ui-text-label-sm hero__prize-label">{{ t('pub.top.label') }}</p>
        <p class="hero__prize-value">{{ topValue }}</p>
        <p v-if="top.valueLabel && top.name" class="ui-text-body-s">{{ top.name }}</p>
        <p v-if="top.description" class="ui-text-caption hero__prize-note">{{ top.description }}</p>
      </aside>
    </section>

    <section v-if="hasSections.prizes" id="prizes" class="band" aria-labelledby="prizes-title">
      <p class="eyebrow ui-text-label-sm">{{ t('pub.prizes.eyebrow') }}</p>
      <h2 id="prizes-title" class="ui-text-h1">{{ t('pub.prizes.title') }}</h2>
      <p class="ui-text-body-s ui-text-hint">{{ prizeSummary }}</p>
      <ul class="tiers">
        <li v-for="(p, i) in tiers" :key="`${i}-${p.name}`" class="tier" :data-top="i === 0">
          <p class="tier__top ui-text-label-sm">
            <span>{{ i === 0 ? t('cmp.preview.top') : t('cmp.preview.tier', { n: i + 1 }) }}</span>
            <UiBadge tone="info">{{ winnersText(p.winners) }}</UiBadge>
          </p>
          <h3 class="ui-text-h3">{{ p.name }}</h3>
          <p v-if="p.valueLabel" class="tier__value">{{ p.valueLabel }}</p>
          <p v-if="p.description" class="ui-text-body-s ui-text-hint">{{ p.description }}</p>
        </li>
      </ul>
    </section>

    <section v-if="hasSections.details" id="details" class="band" aria-labelledby="details-title">
      <p class="eyebrow ui-text-label-sm">{{ t('pub.details.eyebrow') }}</p>
      <h2 id="details-title" class="ui-text-h1">{{ t('pub.details.title') }}</h2>
      <p class="ui-text-body">{{ isSurvey ? t('pub.details.survey') : t('pub.details.quiz') }}</p>
      <ul class="rules">
        <li v-for="d in details" :key="d" class="ui-text-body">{{ d }}</li>
        <li class="ui-text-body">{{ closes }}</li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.view {
  display: flex;
  inline-size: 100%;
  max-inline-size: 72rem;
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
  flex-direction: column;
  gap: var(--ui-space-8);
  margin-block: var(--ui-space-6) var(--ui-space-12);
}
.view h1,
.view h2,
.view h3,
.view p,
.view ul {
  margin: 0;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-color-selected-bg);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.bar__label {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-text-secondary);
}
.bar__dot {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  background: var(--ui-color-action-primary);
  border-radius: var(--ui-radius-pill);
}
.bar__time {
  display: inline-flex;
  gap: var(--ui-space-2);
}
.unit {
  display: inline-flex;
  align-items: baseline;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
  font-variant-numeric: tabular-nums;
}
.unit .ui-text-label-sm {
  text-transform: uppercase;
  color: var(--ui-color-text-secondary);
}
.bar__ends {
  color: var(--ui-color-text-secondary);
}
.hero {
  display: grid;
  gap: var(--ui-space-8);
  align-items: center;
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 64rem) {
  .hero {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }
}
.hero__copy {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  align-items: flex-start;
}
.chips,
.facts,
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
  padding: 0;
  list-style: none;
}
.actions {
  gap: var(--ui-space-3);
}
.intro {
  color: var(--ui-color-text-secondary);
  max-inline-size: 60ch;
}
.hero__prize {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-8);
  color: var(--ui-color-text-inverse);
  background: var(--ui-color-surface-inverse);
  border-radius: var(--ui-radius-xl);
}
.hero__prize-label {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-text-inverse-muted);
}
.hero__prize-value {
  font-size: var(--ui-font-h1-size);
  line-height: var(--ui-font-h1-line);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.hero__prize-note {
  color: var(--ui-color-text-inverse-muted);
}
.band {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-8) var(--ui-space-6);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-xl);
  scroll-margin-block-start: var(--ui-space-12);
}
.eyebrow {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-selected-text);
}
.tiers {
  display: grid;
  gap: var(--ui-space-4);
  margin-block-start: var(--ui-space-4) !important;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
}
.tier {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-5);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.tier[data-top='true'] {
  border: 2px solid var(--ui-color-action-primary);
}
.tier__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ui-color-text-secondary);
}
.tier__value {
  font-size: var(--ui-font-h1-size);
  line-height: var(--ui-font-h1-line);
  font-weight: 700;
  color: var(--ui-color-selected-text);
  overflow-wrap: anywhere;
}
.rules {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  padding-inline-start: var(--ui-space-5);
}
</style>
