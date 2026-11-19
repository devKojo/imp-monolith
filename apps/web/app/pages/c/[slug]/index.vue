<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../../i18n';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { useAuth } from '../../../modules/auth/composables/useAuth';
import { toApiError } from '../../../modules/auth/errors';
import { quizErrorKey } from '../../../modules/quiz/errors';
import { surveyErrorKey } from '../../../modules/survey/errors';
import type { SurveyInfo } from '../../../modules/survey/types';
import { useSurvey } from '../../../modules/survey/useSurvey';
import { useQuiz } from '../../../modules/quiz/useQuiz';
import type { PublicCampaignPage, QuizInfo } from '../../../modules/quiz/types';
import PublicCampaignView from '../../../modules/campaigns/components/PublicCampaignView.vue';
import { siteFooter } from '../../../modules/site/footer';

/**
 * The page of a running campaign (/c/{slug}). For a quiz or a survey it shows the facts and the way in:
 * sign in with a participant account, then start (or continue, or see the result). Other kinds of
 * campaign are listed on the discovery page but cannot be entered yet. Rendered in the browser: it reads the
 * signed-in state to choose the button.
 */
definePageMeta({ ssr: false });

const slug = String(useRoute().params.slug);
const quiz = useQuiz();
const survey = useSurvey();
const auth = useAuth();
const footer = siteFooter();

type Standing = 'signedOut' | 'business' | 'none' | 'inProgress' | 'done';
const state = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
const campaign = ref<PublicCampaignPage | null>(null);
const info = ref<QuizInfo | null>(null);
const surveyInfo = ref<SurveyInfo | null>(null);
const standing = ref<Standing>('signedOut');
const problem = ref('');
const starting = ref(false);

useHead({ title: computed(() => campaign.value?.title || t('quiz.page.title')) });

async function load() {
  state.value = 'loading';
  try {
    campaign.value = await quiz.campaign(slug);
    if (campaign.value.type === 'quiz') info.value = await quiz.info(slug);
    if (campaign.value.type === 'survey') surveyInfo.value = await survey.info(slug);
  } catch (e) {
    state.value = toApiError(e).status === 404 ? 'unavailable' : 'error';
    return;
  }
  state.value = 'ready';
  if (info.value || surveyInfo.value) await findStanding();
}

/** Where this visitor stands, if they are signed in; never redirects, the page is public. */
async function findStanding() {
  const session = await auth.ensure().catch(() => null);
  if (!session) return (standing.value = 'signedOut');
  if (session.user.accountType !== 'PARTICIPANT') return (standing.value = 'business');
  try {
    if (surveyInfo.value) {
      const response = await survey.current(slug);
      standing.value = response.submittedAt ? 'done' : 'inProgress';
    } else {
      const attempt = await quiz.current(slug);
      standing.value = attempt.result ? 'done' : 'inProgress';
    }
  } catch (e) {
    const code = toApiError(e).code;
    standing.value = code === 'NO_ATTEMPT' || code === 'NO_RESPONSE' ? 'none' : 'signedOut';
  }
}
onMounted(load);

async function start() {
  starting.value = true;
  problem.value = '';
  try {
    if (surveyInfo.value) {
      if (standing.value === 'none') await survey.start(slug);
      await navigateTo(`/c/${slug}/survey`);
    } else {
      if (standing.value === 'none') await quiz.start(slug);
      await navigateTo(`/c/${slug}/quiz`);
    }
  } catch (e) {
    const err = toApiError(e);
    problem.value = t(surveyInfo.value ? surveyErrorKey(err) : quizErrorKey(err));
  } finally {
    starting.value = false;
  }
}

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
// A full prize pool takes no new person; people already in keep their button to carry on.
const full = computed(() => (campaign.value?.pool?.spotsLeft ?? 1) < 1);
const action = computed(() => {
  const isSurvey = surveyInfo.value !== null;
  return {
    none: full.value ? '' : t(isSurvey ? 'survey.start' : 'quiz.start'),
    inProgress: t(isSurvey ? 'survey.resume' : 'quiz.resume'),
    done: t(isSurvey ? 'survey.viewResult' : 'quiz.viewResult'),
    signedOut: t(isSurvey ? 'survey.signin' : 'quiz.signin'),
    business: '',
  }[standing.value];
});
const signinTo = `/signin?next=${encodeURIComponent(`/c/${slug}`)}`;
</script>

<template>
  <UiPublicShell
    wide
    :brand-name="BRAND_NAME"
    :footer-tagline="footer.tagline"
    :footer-columns="footer.columns"
    :copyright="footer.copyright"
  >
    <template #nav>
      <UiLink to="/discover">{{ t('nav.discover') }}</UiLink>
      <template v-if="state === 'ready' && campaign">
        <UiLink v-if="campaign.prizes.length > 0" to="#prizes">{{ t('pub.nav.prizes') }}</UiLink>
        <UiLink v-if="info || surveyInfo" to="#details">{{ t('pub.nav.details') }}</UiLink>
      </template>
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

    <PublicCampaignView
      v-else
      :campaign="campaign"
      :info="info"
      :survey="surveyInfo"
      :action-label="action"
      :action-to="standing === 'signedOut' ? signinTo : null"
      :starting="starting"
      :problem="problem"
      :business-account="standing === 'business'"
      :zone="zone"
      @action="start"
    />
  </UiPublicShell>
</template>
