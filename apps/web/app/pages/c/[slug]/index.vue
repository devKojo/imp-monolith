<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { useAuth } from '../../../modules/auth/composables/useAuth';
import { toApiError } from '../../../modules/auth/errors';
import { quizErrorKey } from '../../../modules/quiz/errors';
import { useQuiz } from '../../../modules/quiz/useQuiz';
import type { PublicCampaignPage, QuizInfo } from '../../../modules/quiz/types';
import { siteFooter } from '../../../modules/site/footer';

/**
 * The page of a running campaign (/c/{slug}). For a quiz it shows the rules and the way in: sign in
 * with a participant account, then start (or continue, or see the result). Other kinds of campaign
 * are listed on the discovery page but cannot be entered yet. Rendered in the browser: it reads the
 * signed-in state to choose the button.
 */
definePageMeta({ ssr: false });

const slug = String(useRoute().params.slug);
const quiz = useQuiz();
const auth = useAuth();
const footer = siteFooter();

type Standing = 'signedOut' | 'business' | 'none' | 'inProgress' | 'done';
const state = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
const campaign = ref<PublicCampaignPage | null>(null);
const info = ref<QuizInfo | null>(null);
const standing = ref<Standing>('signedOut');
const problem = ref('');
const starting = ref(false);

useHead({ title: computed(() => campaign.value?.title || t('quiz.page.title')) });

async function load() {
  state.value = 'loading';
  try {
    campaign.value = await quiz.campaign(slug);
    if (campaign.value.type === 'quiz') info.value = await quiz.info(slug);
  } catch (e) {
    state.value = toApiError(e).status === 404 ? 'unavailable' : 'error';
    return;
  }
  state.value = 'ready';
  if (info.value) await findStanding();
}

/** Where this visitor stands, if they are signed in; never redirects, the page is public. */
async function findStanding() {
  const session = await auth.ensure().catch(() => null);
  if (!session) return (standing.value = 'signedOut');
  if (session.user.accountType !== 'PARTICIPANT') return (standing.value = 'business');
  try {
    const attempt = await quiz.current(slug);
    standing.value = attempt.result ? 'done' : 'inProgress';
  } catch (e) {
    standing.value = toApiError(e).code === 'NO_ATTEMPT' ? 'none' : 'signedOut';
  }
}
onMounted(load);

async function start() {
  starting.value = true;
  problem.value = '';
  try {
    if (standing.value === 'none') await quiz.start(slug);
    await navigateTo(`/c/${slug}/quiz`);
  } catch (e) {
    problem.value = t(quizErrorKey(toApiError(e)));
  } finally {
    starting.value = false;
  }
}

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const rules = computed(() => {
  const i = info.value;
  if (!i) return [];
  return [
    t('quiz.rules.questions', { n: i.questionCount }),
    i.timeLimitMinutes ? t('quiz.rules.time', { n: i.timeLimitMinutes }) : t('quiz.rules.untimed'),
    t('quiz.rules.pass', { n: i.passPercent }),
    t('quiz.rules.ends', { date: formatInZone(new Date(i.endsAt), zone) }),
  ];
});
const action = computed(
  () =>
    ({
      none: t('quiz.start'),
      inProgress: t('quiz.resume'),
      done: t('quiz.viewResult'),
      signedOut: t('quiz.signin'),
      business: '',
    })[standing.value],
);
const signinTo = computed(() => ({ path: '/signin', query: { next: `/c/${slug}` } }));
</script>

<template>
  <UiPublicShell
    :brand-name="BRAND_NAME"
    :footer-tagline="footer.tagline"
    :footer-columns="footer.columns"
    :copyright="footer.copyright"
  >
    <template #nav>
      <UiLink to="/discover">{{ t('nav.discover') }}</UiLink>
    </template>
    <template #actions>
      <UiButton to="/signin" variant="tertiary" size="xs">{{ t('nav.signin') }}</UiButton>
    </template>

    <UiSkeleton v-if="state === 'loading'" variant="card" />

    <UiEmptyState
      v-else-if="state === 'unavailable'"
      :title="t('quiz.unavailable.title')"
      :description="t('quiz.unavailable.body')"
    >
      <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.back') }}</UiButton>
    </UiEmptyState>

    <UiSystemState v-else-if="state === 'error' || !campaign" kind="generic" @action="load" />

    <UiCard v-else as="article" aria-labelledby="campaign-title" class="page">
      <UiBadge tone="info" shape="pill">{{
        t(`type.${campaign.type}.one` as 'type.quiz.one')
      }}</UiBadge>
      <h1 id="campaign-title" class="ui-text-h1">{{ campaign.title }}</h1>
      <p class="ui-text-caption ui-text-hint">
        {{ t('quiz.by', { business: campaign.businessName }) }}
      </p>
      <p v-if="campaign.summary" class="ui-text-body">{{ campaign.summary }}</p>

      <template v-if="info">
        <ul class="rules">
          <li v-for="r in rules" :key="r">
            <UiBadge shape="pill">{{ r }}</UiBadge>
          </li>
        </ul>
        <UiBanner v-if="info.questionCount === 0" tone="info">{{ t('quiz.empty') }}</UiBanner>
        <template v-else>
          <UiBanner v-if="standing === 'business'" tone="info">
            {{ t('quiz.businessAccount') }}
          </UiBanner>
          <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
          <div v-if="standing !== 'business'" class="page__action">
            <UiButton
              v-if="standing === 'signedOut'"
              :to="signinTo"
              size="xs"
              icon-trailing="arrow-right"
            >
              {{ action }}
            </UiButton>
            <UiButton
              v-else
              size="xs"
              icon-trailing="arrow-right"
              :loading="starting"
              :loading-label="t('quiz.saving')"
              @click="start"
            >
              {{ action }}
            </UiButton>
            <p v-if="standing === 'signedOut'" class="ui-text-caption ui-text-hint">
              {{ t('quiz.signin.hint') }}
            </p>
          </div>
        </template>
      </template>
      <UiBanner v-else tone="info">{{ t('quiz.notQuiz') }}</UiBanner>
    </UiCard>
  </UiPublicShell>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  align-items: flex-start;
  margin-block: var(--ui-space-8);
}
.page h1,
.page p {
  margin: 0;
}
.rules {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.page__action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
}
</style>
