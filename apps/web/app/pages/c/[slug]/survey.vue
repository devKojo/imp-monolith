<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { t } from '../../../i18n';
import { useUnavailableExit } from '../../../modules/auth/composables/useHomeLink';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { toApiError } from '../../../modules/auth/errors';
import { siteFooter } from '../../../modules/site/footer';
import { useMyRewards } from '../../../modules/rewards/useMyRewards';
import SurveyDone from '../../../modules/survey/components/SurveyDone.vue';
import SurveyStepCard from '../../../modules/survey/components/SurveyStepCard.vue';
import { surveyErrorKey } from '../../../modules/survey/errors';
import {
  answeredCount,
  buildSteps,
  missingIn,
  progressPercent,
  resumeIndex,
  stepOf,
} from '../../../modules/survey/logic';
import type { Answers, ResponseView, SurveyInfo } from '../../../modules/survey/types';
import { useSurvey } from '../../../modules/survey/useSurvey';

/**
 * The survey screen. One screen at a time (ratings that follow each other share a screen as a matrix).
 * Choosing an option saves it at once; written answers save when the field is left or the screen
 * changes, so nothing is lost if the connection drops later. Saves run one after another so a quick
 * change of mind cannot be stored out of order. Required questions are checked when moving on and again
 * by the server when submitting.
 */
const exit = useUnavailableExit();
definePageMeta({ middleware: 'auth', portal: 'participant', ssr: false });

const slug = String(useRoute().params.slug);
const survey = useSurvey();
const footer = siteFooter();

const state = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
const view = ref<ResponseView | null>(null);
const info = ref<SurveyInfo | null>(null);
const index = ref(0);
const missing = ref<string[]>([]);
const saving = ref(false);
const problem = ref('');
const confirmOpen = ref(false);
const submitting = ref(false);

useHead({ title: computed(() => info.value?.title || t('survey.page.title')) });

const steps = computed(() => buildSteps(view.value?.questions ?? []));
const step = computed(() => steps.value[Math.min(index.value, steps.value.length - 1)] ?? null);
const answers = computed<Answers>(() => view.value?.answers ?? {});
const percent = computed(() => progressPercent(index.value, steps.value.length));
const done = computed(() => (view.value?.submittedAt ?? null) !== null);

// Finishing may have won a tier (prizes given to the first to finish): find it among the person's awards.
const myRewards = useMyRewards();
const reward = computed(
  () =>
    myRewards.awards.data.value.items.find(
      (a) => a.campaign.slug === slug && a.source === 'COMPLETION',
    ) ?? null,
);
watch(done, (finished) => {
  if (finished) void myRewards.refresh();
});

async function load() {
  state.value = 'loading';
  try {
    const [response, facts] = await Promise.all([
      survey.current(slug),
      survey.info(slug).catch(() => null),
    ]);
    view.value = response;
    info.value = facts;
    index.value = resumeIndex(buildSteps(response.questions), response.answers);
    state.value = 'ready';
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'NO_RESPONSE') return void navigateTo(`/c/${slug}`);
    state.value = err.status === 404 ? 'unavailable' : 'error';
  }
}
onMounted(load);

// ---- answering. Saves run one after another, so a quick change of mind cannot be saved out of order.
let queue: Promise<void> = Promise.resolve();
const dirtyText = new Set<string>();

function setAnswer(id: string, value: Answers[string] | undefined) {
  if (!view.value) return;
  const next = { ...view.value.answers };
  if (value === undefined) delete next[id];
  else next[id] = value;
  view.value = { ...view.value, answers: next };
}

function save(id: string, value: Answers[string], rollback?: Answers[string]) {
  saving.value = true;
  queue = queue
    .then(() => survey.answer(slug, id, value))
    .catch(async (e) => {
      const err = toApiError(e);
      if (err.code === 'RESPONSE_CLOSED') {
        view.value = await survey.current(slug).catch(() => view.value);
      } else if (rollback !== undefined || value.choiceIndex !== undefined) {
        setAnswer(id, rollback);
      }
      problem.value = t(surveyErrorKey(err));
    })
    .finally(() => {
      saving.value = false;
    });
}

function choose(id: string, choiceIndex: number) {
  if (!view.value || done.value) return;
  const before = view.value.answers[id];
  setAnswer(id, { choiceIndex });
  problem.value = '';
  missing.value = missing.value.filter((m) => m !== id);
  save(id, { choiceIndex }, before);
}

function write(id: string, text: string) {
  if (!view.value || done.value) return;
  setAnswer(id, text.trim() === '' ? undefined : { text });
  dirtyText.add(id);
  missing.value = missing.value.filter((m) => m !== id);
}

/** Saves the written answers that changed since they were last saved (an empty one clears it). */
async function flush() {
  const ids = [...dirtyText];
  dirtyText.clear();
  for (const id of ids) save(id, { text: answers.value[id]?.text ?? '' });
  await queue;
}

const go = async (to: number) => {
  await flush();
  index.value = Math.min(Math.max(0, to), steps.value.length - 1);
  missing.value = [];
  problem.value = '';
};

async function next() {
  await flush();
  const open = step.value ? missingIn(step.value, answers.value) : [];
  if (open.length > 0) {
    missing.value = open.map((q) => q.id);
    problem.value = t('survey.error.required');
    return;
  }
  await go(index.value + 1);
}

async function review() {
  await flush();
  const open = steps.value.flatMap((s) => missingIn(s, answers.value));
  if (open.length > 0) {
    const ids = open.map((q) => q.id);
    index.value = stepOf(steps.value, ids);
    missing.value = ids.filter((id) => step.value?.questions.some((q) => q.id === id));
    problem.value = t('survey.error.required');
    return;
  }
  confirmOpen.value = true;
}

async function submit() {
  submitting.value = true;
  problem.value = '';
  try {
    await flush();
    view.value = await survey.submit(slug);
    confirmOpen.value = false;
  } catch (e) {
    const err = toApiError(e);
    confirmOpen.value = false;
    problem.value = t(surveyErrorKey(err));
    if (err.code === 'ANSWERS_REQUIRED') await load();
  } finally {
    submitting.value = false;
  }
}

const unanswered = computed(
  () =>
    (view.value?.questions.length ?? 0) - answeredCount(view.value?.questions ?? [], answers.value),
);
</script>

<template>
  <UiPublicShell
    :brand-name="BRAND_NAME"
    wide
    :footer-tagline="footer.tagline"
    :footer-columns="footer.columns"
    :copyright="footer.copyright"
  >
    <UiSkeleton v-if="state === 'loading'" variant="card" />

    <UiEmptyState
      v-else-if="state === 'unavailable'"
      :title="t('survey.unavailable.title')"
      :description="t('survey.unavailable.body')"
    >
      <UiButton :to="exit.to" variant="secondary" size="xs">{{ exit.label }}</UiButton>
    </UiEmptyState>

    <UiSystemState v-else-if="state === 'error' || !view" kind="generic" @action="load" />

    <div v-else-if="done" class="wrap solo">
      <SurveyDone :title="info?.title ?? t('survey.page.title')" :reward="reward" />
    </div>

    <div v-else-if="step" class="wrap screen">
      <header class="head">
        <div class="head__titles">
          <p class="ui-text-label-sm head__kicker">{{ t('survey.page.title') }}</p>
          <p v-if="info" class="ui-text-h3 head__title">{{ info.title }}</p>
        </div>
        <UiBadge v-if="info" shape="pill">
          {{ t('survey.estimate', { n: info.estimatedMinutes }) }}
        </UiBadge>
      </header>

      <div class="progress">
        <p class="ui-text-label-sm" role="status">
          {{ t('survey.progress', { percent, n: index + 1, total: steps.length }) }}
        </p>
        <UiProgress :value="percent" :label="t('survey.progress.label')" />
      </div>

      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

      <SurveyStepCard
        :step="step"
        :index="index"
        :total="steps.length"
        :answers="answers"
        :missing="missing"
        :saving="saving"
        @choose="choose"
        @write="write"
        @leave="flush"
        @previous="go(index - 1)"
        @next="next"
        @finish="review"
      />

      <UiBanner tone="info" :title="t('survey.notice.title')">{{
        t('survey.notice.body')
      }}</UiBanner>
    </div>

    <UiConfirmDialog
      v-model:open="confirmOpen"
      :title="t('survey.confirm.title')"
      :consequence="
        unanswered > 0
          ? t('survey.confirm.consequence', { n: unanswered })
          : t('survey.confirm.none')
      "
      :confirm-label="t('survey.finish')"
      :loading="submitting"
      @confirm="submit"
    />
  </UiPublicShell>
</template>

<style scoped>
.wrap {
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 14);
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
}
@media (min-width: 768px) {
  .wrap {
    padding-inline: var(--ui-space-8);
  }
}
.solo {
  max-inline-size: calc(var(--ui-space-12) * 12);
  margin-block: var(--ui-space-8);
}
.screen {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
  margin-block: var(--ui-space-6);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.head__titles {
  min-inline-size: 0;
}
.head__kicker {
  margin: 0;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-selected-text);
}
.head__title {
  margin: 0;
  overflow-wrap: anywhere;
}
.progress {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.progress p {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
</style>
