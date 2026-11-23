<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '../../../i18n';
import { useUnavailableExit } from '../../../modules/auth/composables/useHomeLink';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { toApiError } from '../../../modules/auth/errors';
import { siteFooter } from '../../../modules/site/footer';
import QuizQuestionCard from '../../../modules/quiz/components/QuizQuestionCard.vue';
import QuizQuestionList from '../../../modules/quiz/components/QuizQuestionList.vue';
import QuizResult from '../../../modules/quiz/components/QuizResult.vue';
import { quizErrorKey } from '../../../modules/quiz/errors';
import {
  resumeIndex,
  secondsRemaining,
  totalSeconds,
  unanswered,
} from '../../../modules/quiz/logic';
import type { AttemptView, QuizInfo } from '../../../modules/quiz/types';
import { useOpenCampaigns } from '../../../modules/participant/useOpenCampaigns';
import { useQuiz } from '../../../modules/quiz/useQuiz';
import { useMyRewards } from '../../../modules/rewards/useMyRewards';

/**
 * The quiz screen. One question at a time; choosing an option saves it at once, so nothing is lost if
 * the connection drops later. The server owns the clock: the countdown is the server's deadline
 * measured with the device's elapsed time, and when it reaches zero the server closes the attempt and
 * scores what was answered. Nothing here knows a correct answer.
 */
const exit = useUnavailableExit();
definePageMeta({ middleware: 'auth', portal: 'participant', ssr: false });

const slug = String(useRoute().params.slug);
const quiz = useQuiz();
const footer = siteFooter();

const state = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
const view = ref<AttemptView | null>(null);
const receivedAt = ref(0);
const index = ref(0);
const flagged = ref<ReadonlySet<string>>(new Set());
const saving = ref(false);
const problem = ref('');
const confirmOpen = ref(false);
const submitting = ref(false);
const timeUp = ref(false);
// The title and rules for the result page. Optional: the page still works without them.
const info = ref<QuizInfo | null>(null);
const openCampaigns = useOpenCampaigns();
const next = computed(() => openCampaigns.campaigns.value.find((c) => c.slug !== slug) ?? null);
// Confetti only when the result arrives in this visit, not when coming back to a finished quiz.
const celebrate = ref(false);

// A pass may have won a tier (prizes given to the first to pass): find it among the person's awards.
const myRewards = useMyRewards();
const reward = computed(
  () =>
    myRewards.awards.data.value.items.find(
      (a) => a.campaign.slug === slug && a.source === 'COMPLETION',
    ) ?? null,
);
// The award is made when the quiz is finished, so look again then.
watch(
  () => view.value?.result?.passed,
  (passed) => {
    if (passed) void myRewards.refresh();
  },
);
const retaking = ref(false);

useHead({ title: t('quiz.page.title') });

const adopt = (next: AttemptView) => {
  view.value = next;
  receivedAt.value = Date.now();
};

async function load() {
  state.value = 'loading';
  try {
    adopt(await quiz.current(slug));
    index.value = resumeIndex(view.value!);
    state.value = 'ready';
    void quiz
      .info(slug)
      .then((i) => (info.value = i))
      .catch(() => undefined);
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'NO_ATTEMPT') return void navigateTo(`/c/${slug}`);
    state.value = err.status === 404 ? 'unavailable' : 'error';
  }
}

// ---- the clock
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  ticker = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => ticker && clearInterval(ticker));

const left = computed(() =>
  view.value ? secondsRemaining(view.value, receivedAt.value, now.value) : null,
);
const timed = computed(() => left.value !== null && view.value?.result === null);

// When time runs out the server closes the attempt; ask it for the result.
watch(left, async (seconds) => {
  if (seconds !== 0 || !view.value || view.value.result) return;
  timeUp.value = true;
  try {
    adopt(await quiz.current(slug));
    celebrate.value = true;
  } catch {
    problem.value = t('quiz.error.generic');
  }
});

// ---- answering. Saves run one after another, so a quick change of mind cannot be saved out of order.
let queue: Promise<void> = Promise.resolve();
function choose(choice: number) {
  const current = view.value?.questions[index.value];
  if (!view.value || !current || view.value.result) return;
  const before = view.value.answers[current.id];
  view.value = { ...view.value, answers: { ...view.value.answers, [current.id]: choice } };
  problem.value = '';
  saving.value = true;
  queue = queue
    .then(() => quiz.answer(slug, current.id, choice))
    .catch(async (e) => {
      const err = toApiError(e);
      if (err.code === 'ATTEMPT_CLOSED') {
        adopt(await quiz.current(slug).catch(() => view.value!));
      } else if (view.value) {
        const answers = { ...view.value.answers };
        if (before === undefined) delete answers[current.id];
        else answers[current.id] = before;
        view.value = { ...view.value, answers };
      }
      problem.value = t(quizErrorKey(err));
    })
    .finally(() => {
      saving.value = false;
    });
}

function toggleFlag() {
  const id = view.value?.questions[index.value]?.id;
  if (!id) return;
  const next = new Set(flagged.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  flagged.value = next;
}

/** Starts the next attempt and begins at its first question. */
async function retake() {
  retaking.value = true;
  problem.value = '';
  try {
    adopt(await quiz.retake(slug));
    index.value = resumeIndex(view.value!);
    flagged.value = new Set();
    timeUp.value = false;
    celebrate.value = false;
  } catch (e) {
    problem.value = t(quizErrorKey(toApiError(e)));
  } finally {
    retaking.value = false;
  }
}

const go = (to: number) => {
  if (view.value) index.value = Math.min(Math.max(0, to), view.value.questions.length - 1);
};

async function finish() {
  if (!view.value) return;
  submitting.value = true;
  problem.value = '';
  try {
    await queue; // let the last answer land first
    adopt(await quiz.submit(slug));
    celebrate.value = true;
    confirmOpen.value = false;
  } catch (e) {
    problem.value = t(quizErrorKey(toApiError(e)));
    confirmOpen.value = false;
  } finally {
    submitting.value = false;
  }
}

const question = computed(() => view.value?.questions[index.value] ?? null);
const open = computed(() => (view.value ? unanswered(view.value) : 0));
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
      :title="t('quiz.unavailable.title')"
      :description="t('quiz.unavailable.body')"
    >
      <UiButton :to="exit.to" variant="secondary" size="xs">{{ exit.label }}</UiButton>
    </UiEmptyState>

    <UiSystemState v-else-if="state === 'error' || !view" kind="generic" @action="load" />

    <div v-else-if="view.result" class="wrap solo">
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <QuizResult
        :view="view"
        :info="info"
        :next="next"
        :now="openCampaigns.now.value"
        :time-up="timeUp"
        :celebrate="celebrate"
        :reward="reward"
        :retaking="retaking"
        @retake="retake"
      />
    </div>

    <div v-else-if="question" class="wrap screen">
      <div class="screen__main">
        <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
        <QuizQuestionCard
          :question="question"
          :index="index"
          :total="view.questions.length"
          :selected="view.answers[question.id]"
          :flagged="flagged.has(question.id)"
          :saving="saving"
          @select="choose"
          @previous="go(index - 1)"
          @next="go(index + 1)"
          @flag="toggleFlag"
          @finish="confirmOpen = true"
        />
      </div>

      <aside class="screen__side">
        <UiCard v-if="timed && left !== null" as="section" class="timer">
          <UiCountdown
            :seconds-remaining="left"
            :total-seconds="totalSeconds(view)"
            :label="t('quiz.timer')"
          />
        </UiCard>
        <p v-else class="ui-text-caption ui-text-hint">{{ t('quiz.untimed') }}</p>
        <QuizQuestionList :view="view" :current="index" :flagged="flagged" @select="go" />
      </aside>
    </div>

    <UiConfirmDialog
      v-model:open="confirmOpen"
      :title="t('quiz.confirm.title')"
      :consequence="open > 0 ? t('quiz.confirm.consequence', { n: open }) : t('quiz.confirm.none')"
      :confirm-label="t('quiz.finish')"
      :loading="submitting"
      @confirm="finish"
    />
  </UiPublicShell>
</template>

<style scoped>
.wrap {
  inline-size: 100%;
  max-inline-size: var(--ui-layout-content-max);
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
}
@media (min-width: 768px) {
  .wrap {
    padding-inline: var(--ui-space-8);
  }
}
.solo {
  /* The result is a two-column dashboard, so it gets the full content width. */
  margin-block: var(--ui-space-8);
}
.screen {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-space-6);
  margin-block: var(--ui-space-6);
}
@media (min-width: 1024px) {
  .screen {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: start;
  }
  .screen__side {
    position: sticky;
    inset-block-start: calc(var(--ui-space-12) + var(--ui-space-4));
  }
}
.screen__main,
.screen__side {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.screen__side p {
  margin: 0;
}
</style>
