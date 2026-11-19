<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from '@imp/ui/app/composables/useToast';
import { t, type AppTextKey } from '../../../i18n';
import { toApiError } from '../../../modules/auth/errors';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import CampaignChecks from '../../../modules/campaigns/components/CampaignChecks.vue';
import CampaignPagePreview from '../../../modules/campaigns/components/CampaignPagePreview.vue';
import ContentEditor from '../../../modules/campaigns/components/ContentEditor.vue';
import ShareCampaign from '../../../modules/campaigns/components/ShareCampaign.vue';
import PrizeEditor from '../../../modules/campaigns/components/PrizeEditor.vue';
import { campaignErrorKey } from '../../../modules/campaigns/errors';
import { defaultSettingsFor, fitToTemplate } from '../../../modules/campaigns/fields';
import {
  LIMITS,
  addPrize,
  browserZone,
  clone,
  fromParts,
  isArchivable,
  isLaunchable,
  movePrize,
  newPrize,
  preflight,
  removePrize,
  toParts,
  updatePrize,
  type DateParts,
} from '../../../modules/campaigns/logic';
import type {
  Campaign,
  CampaignField,
  CampaignSettings,
  Prize,
  PrizePool,
  TemplateRef,
} from '../../../modules/campaigns/types';
import { isPublicNow, pagePath } from '../../../modules/campaigns/publicPage';
import { useCampaigns } from '../../../modules/campaigns/useCampaigns';
import { useTemplates } from '../../../modules/templates/useTemplates';

/**
 * Campaign builder. The page edits a working copy of the campaign it loaded from the API: Save sends
 * it back with the version it read, Discard throws it away. Only a draft is editable; once launched
 * the campaign can be paused, resumed or cancelled. Everything that can be derived (checks, whether it
 * can launch) is computed from the working copy; the server runs the same checks again when launching
 * and has the last word. The preview shows the public page, built from the same fields and the entry
 * form of the chosen template.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });

const route = useRoute();
const id = String(route.params.id);
const store = useCampaigns();
const templatesApi = useTemplates();
const toast = useToast();

const state = ref<'loading' | 'ready' | 'notfound' | 'error'>('loading');
const draft = ref<Campaign | null>(null);
const savedJson = ref('');
const dirty = computed(
  () => draft.value !== null && JSON.stringify(draft.value) !== savedJson.value,
);
// Explanations of what is unfinished appear once the person has saved (or tried to launch).
const showProblems = ref(false);
const busy = ref(false);
const problem = ref('');
const conflict = ref(false);

const available = ref<TemplateRef[]>([]);

useHead({ title: computed(() => draft.value?.title || t('cmp.title')) });

const canManage = store.canManage;
const canOperate = store.canOperate;
const isDraft = computed(() => draft.value?.status === 'DRAFT');
const isArchived = computed(() => Boolean(draft.value?.archivedAt));
const archivable = computed(() => !!draft.value && isArchivable(draft.value.status));
const readonly = computed(() => !isDraft.value || !canManage.value || isArchived.value);
const titleProblem = computed(() =>
  draft.value && draft.value.title.trim() === '' ? t('cmp.title.required') : undefined,
);

// No native maxlength on the description: it would silently cut a long paste (or refuse it when the
// field is full). The text is accepted, counted, and flagged while it is over the limit.
const summaryProblem = computed(() =>
  draft.value && draft.value.summary.length > LIMITS.summary
    ? t('cmp.summary.tooLong', { max: LIMITS.summary })
    : undefined,
);

const checks = computed(() => (draft.value ? preflight(draft.value, new Date()) : []));
const launchable = computed(
  () =>
    draft.value !== null &&
    isLaunchable(draft.value, new Date()) &&
    !titleProblem.value &&
    !summaryProblem.value,
);
const runningStatus = computed(
  () => draft.value?.status === 'LIVE' || draft.value?.status === 'SCHEDULED',
);

/** The public page is open now: offer to view and share it. */
const publicSlug = computed(() =>
  draft.value && isPublicNow(draft.value, new Date()) ? draft.value.slug : null,
);

// ---- schedule: the fields keep what is typed; the campaign gets an instant once it is complete
const zone = ref(browserZone());
const startParts = ref<DateParts>(toParts(null, zone.value));
const endParts = ref<DateParts>(toParts(null, zone.value));
const syncParts = () => {
  startParts.value = toParts(draft.value?.startAt ?? null, zone.value);
  endParts.value = toParts(draft.value?.endAt ?? null, zone.value);
};
function applyParts() {
  if (!draft.value) return;
  draft.value = {
    ...draft.value,
    startAt: draft.value.startAt === null ? null : fromParts(startParts.value),
    endAt: fromParts(endParts.value),
  };
}
function setStart(v: DateParts) {
  zone.value = v.zone;
  startParts.value = v;
  endParts.value = { ...endParts.value, zone: v.zone };
  applyParts();
  if (draft.value && draft.value.startAt !== null) {
    draft.value = { ...draft.value, startAt: fromParts(v) };
  }
}
function setEnd(v: DateParts) {
  zone.value = v.zone;
  endParts.value = v;
  startParts.value = { ...startParts.value, zone: v.zone };
  applyParts();
}
const startNow = computed({
  get: () => draft.value?.startAt === null,
  set: (now: boolean) => {
    if (!draft.value) return;
    const nextHour = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000).toISOString();
    draft.value = { ...draft.value, startAt: now ? null : nextHour };
    startParts.value = toParts(draft.value.startAt, zone.value);
  },
});
const zones = computed(() => [...new Set([zone.value, 'UTC'])]);

// ---- loading and the template choice
async function load() {
  state.value = 'loading';
  problem.value = '';
  conflict.value = false;
  try {
    const [campaign, list] = await Promise.all([
      store.get(id),
      templatesApi.list().catch(() => [] as TemplateRef[]),
    ]);
    available.value = list;
    draft.value = clone(campaign);
    savedJson.value = JSON.stringify(campaign);
    syncParts();
    state.value = 'ready';
  } catch (e) {
    state.value = toApiError(e).status === 404 ? 'notfound' : 'error';
  }
}
onMounted(load);

const templateOptions = computed(() => {
  const rows = available.value.map((tpl) => ({ value: tpl.id, label: tpl.name }));
  const chosen = draft.value?.templateId ?? null;
  if (chosen && !rows.some((r) => r.value === chosen)) {
    rows.push({ value: chosen, label: t('cmp.template.unavailable') });
  }
  return rows;
});
const templateHint = computed(
  () => draft.value?.template?.description || t('cmp.field.template.hint'),
);

/**
 * Moving to another type keeps the fields the new type allows, starts from the type's defaults when
 * nothing is left, and brings the settings that type uses (the quiz time limit and pass mark).
 */
function chooseTemplate(templateId: string) {
  if (!draft.value) return;
  const found = available.value.find((tpl) => tpl.id === templateId) ?? null;
  const uid = () => crypto.randomUUID();
  draft.value = {
    ...draft.value,
    templateId: found ? templateId : null,
    template: found,
    fields: found ? fitToTemplate(draft.value.fields, found, uid) : [],
    settings: {
      ...(found?.archetype === draft.value.template?.archetype
        ? draft.value.settings
        : defaultSettingsFor(found)),
      // The prize pool belongs to the campaign, not to its type.
      ...(draft.value.settings.pool ? { pool: draft.value.settings.pool } : {}),
    },
  };
}

const setFields = (fields: CampaignField[]) => {
  if (draft.value) draft.value = { ...draft.value, fields };
};
const setSettings = (settings: CampaignSettings) => {
  // The content editor sends the quiz settings only; the prize pool is kept as it is.
  if (draft.value) {
    draft.value = {
      ...draft.value,
      settings: {
        ...settings,
        ...(draft.value.settings.pool ? { pool: draft.value.settings.pool } : {}),
      },
    };
  }
};
// A campaign gives its prize as tiers or as a pool, never both.
const setPool = (pool: PrizePool | null) => {
  if (!draft.value) return;
  const { pool: _dropped, ...rest } = draft.value.settings;
  draft.value = { ...draft.value, settings: pool ? { ...rest, pool } : rest };
};

// ---- prizes
const setPrizes = (next: Prize[]) => {
  if (draft.value) draft.value = { ...draft.value, prizes: next };
};
const addNewPrize = () => {
  if (draft.value) setPrizes(addPrize(draft.value.prizes, newPrize(crypto.randomUUID())));
};

// ---- actions
function adopt(next: Campaign) {
  draft.value = clone(next);
  savedJson.value = JSON.stringify(next);
  syncParts();
}
function failed(e: unknown) {
  const err = toApiError(e);
  if (err.code === 'VERSION_CONFLICT') conflict.value = true;
  else problem.value = t(campaignErrorKey(err));
}
async function attempt(action: () => Promise<void>): Promise<boolean> {
  if (!draft.value || busy.value) return false;
  problem.value = '';
  conflict.value = false;
  busy.value = true;
  try {
    await action();
    return true;
  } catch (e) {
    failed(e);
    return false;
  } finally {
    busy.value = false;
  }
}

const save = () =>
  attempt(async () => {
    if (titleProblem.value) throw new Error('title');
    if (summaryProblem.value) throw new Error('summary');
    showProblems.value = true;
    adopt(await store.save(draft.value!));
    toast.push(t('cmp.saved'));
  });
async function launch() {
  if (!launchable.value) return;
  if (dirty.value && !(await save())) return;
  await attempt(async () => {
    adopt(await store.launch(draft.value!));
    toast.push(t('cmp.launched'));
  });
}
const pause = () =>
  attempt(async () => {
    adopt(await store.pause(draft.value!));
    toast.push(t('cmp.paused'), 'info');
  });
const resume = () =>
  attempt(async () => {
    adopt(await store.resume(draft.value!));
    toast.push(t('cmp.resumed'), 'info');
  });

const archive = () =>
  attempt(async () => {
    adopt(await store.archive(draft.value!));
    toast.push(t('cmp.archivedDone'), 'info');
  });
const unarchive = () =>
  attempt(async () => {
    adopt(await store.unarchive(draft.value!));
    toast.push(t('cmp.unarchivedDone'), 'info');
  });

const cancelOpen = ref(false);
const cancel = async () => {
  // The dialog stays open while it works (its button shows busy); it closes once the call is done.
  await attempt(async () => {
    adopt(await store.cancel(draft.value!));
    toast.push(t('cmp.cancelled'), 'info');
  });
  cancelOpen.value = false;
};
// Offered for any launched campaign; the server refuses it once someone has taken part.
const canReturnToDraft = computed(
  () =>
    canManage.value &&
    !isArchived.value &&
    (runningStatus.value || draft.value?.status === 'PAUSED' || draft.value?.status === 'CANCELLED'),
);
const toDraftOpen = ref(false);
const returnToDraft = async () => {
  await attempt(async () => {
    adopt(await store.returnToDraft(draft.value!));
    toast.push(t('cmp.toDraft.done'), 'info');
  });
  toDraftOpen.value = false;
};
const republish = () =>
  attempt(async () => {
    adopt(await store.republish(draft.value!));
    toast.push(t('cmp.republished'));
  });

const discardOpen = ref(false);
const leave = () => navigateTo('/app/campaigns');
function close() {
  if (dirty.value) discardOpen.value = true;
  else void leave();
}

const device = ref('mobile');
const deviceOptions = [
  { value: 'mobile', label: t('tpl.device.mobile') },
  { value: 'desktop', label: t('tpl.device.desktop') },
];
const kicker = computed(() =>
  draft.value?.template ? t(`tpl.archetype.${draft.value.template.archetype}` as AppTextKey) : '',
);
const crumbs = computed(() => [
  { label: t('cmp.title'), to: '/app/campaigns' },
  { label: draft.value?.title || t('cmp.newTitle') },
]);
</script>

<template>
  <BusinessShell current="campaigns">
    <UiSkeleton v-if="state === 'loading'" variant="card" />

    <UiEmptyState
      v-else-if="state === 'notfound'"
      :title="t('cmp.notFound.title')"
      :description="t('cmp.notFound.body')"
    >
      <UiButton to="/app/campaigns" variant="secondary" size="xs">
        {{ t('cmp.notFound.back') }}
      </UiButton>
    </UiEmptyState>

    <UiSystemState v-else-if="state === 'error' || !draft" kind="generic" @action="load" />

    <template v-else>
      <UiBreadcrumbs :items="crumbs" />

      <header class="head">
        <div class="head__title">
          <h1 class="ui-text-h1">{{ draft.title || t('cmp.newTitle') }}</h1>
          <UiStatusChip vocabulary="campaign" :status="draft.status" />
          <span v-if="dirty" class="ui-text-caption ui-text-hint" role="status">
            {{ t('cmp.unsaved') }}
          </span>
        </div>
        <div class="head__actions">
          <UiButton variant="tertiary" size="xs" @click="close">
            {{ dirty ? t('cmp.discard') : t('cmp.close') }}
          </UiButton>
          <template v-if="publicSlug">
            <UiButton :to="pagePath(publicSlug)" variant="secondary" size="xs" icon="external">
              {{ t('cmp.viewPage') }}
            </UiButton>
            <ShareCampaign :slug="publicSlug" :title="draft.title" variant="secondary" compact />
          </template>
          <UiButton
            v-if="canManage && isArchived"
            variant="secondary"
            size="xs"
            :disabled="busy"
            @click="unarchive"
          >
            {{ t('cmp.unarchive') }}
          </UiButton>
          <UiButton
            v-else-if="canManage && archivable"
            variant="tertiary"
            size="xs"
            :disabled="busy || dirty"
            @click="archive"
          >
            {{ t('cmp.archive') }}
          </UiButton>
          <template v-if="canManage && isDraft && !isArchived">
            <UiButton
              variant="secondary"
              size="xs"
              :loading="busy"
              :loading-label="t('cmp.saving')"
              :disabled="!dirty || !!titleProblem || !!summaryProblem"
              @click="save"
            >
              {{ t('cmp.save') }}
            </UiButton>
            <UiButton size="xs" :disabled="!launchable || busy" @click="launch">
              {{ t('cmp.launch') }}
            </UiButton>
          </template>
          <template v-else>
            <UiButton
              v-if="canOperate && runningStatus"
              variant="secondary"
              size="xs"
              :disabled="busy"
              @click="pause"
            >
              {{ t('cmp.pause') }}
            </UiButton>
            <UiButton
              v-if="canOperate && draft.status === 'PAUSED'"
              variant="secondary"
              size="xs"
              :disabled="busy"
              @click="resume"
            >
              {{ t('cmp.resume') }}
            </UiButton>
            <UiButton
              v-if="canManage && draft.status === 'CANCELLED' && !isArchived"
              variant="secondary"
              size="xs"
              :disabled="busy"
              @click="republish"
            >
              {{ t('cmp.republish') }}
            </UiButton>
            <UiButton
              v-if="canReturnToDraft"
              variant="secondary"
              size="xs"
              :disabled="busy"
              @click="toDraftOpen = true"
            >
              {{ t('cmp.toDraft') }}
            </UiButton>
            <UiButton
              v-if="canManage && (runningStatus || draft.status === 'PAUSED')"
              variant="tertiary"
              size="xs"
              :disabled="busy"
              @click="cancelOpen = true"
            >
              {{ t('cmp.cancel') }}
            </UiButton>
          </template>
        </div>
      </header>

      <p v-if="readonly" class="ui-text-caption ui-text-hint">
        {{
          !canManage
            ? t('cmp.readonly.role')
            : isArchived
              ? t('cmp.readonly.archived')
              : t('cmp.readonly.launched')
        }}
      </p>
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <UiBanner v-if="conflict" tone="warning" role="alert" :title="t('cmp.error.conflict')">
        <span class="conflict">
          <UiButton variant="secondary" size="xs" @click="load">{{ t('cmp.reload') }}</UiButton>
          <UiButton variant="tertiary" size="xs" @click="conflict = false">
            {{ t('cmp.keepEditing') }}
          </UiButton>
        </span>
      </UiBanner>

      <div class="layout">
        <div class="layout__main">
          <UiCard as="section" class="details">
            <UiTextInput
              id="campaign-title"
              :model-value="draft.title"
              :label="t('cmp.field.title')"
              :maxlength="LIMITS.title"
              :readonly="readonly"
              :error="titleProblem"
              @update:model-value="draft = { ...draft!, title: $event }"
            />
            <UiTextInput
              id="campaign-summary"
              multiline
              :rows="3"
              :model-value="draft.summary"
              :label="t('cmp.field.summary')"
              :hint="t('cmp.summary.count', { used: draft.summary.length, max: LIMITS.summary })"
              :error="summaryProblem"
              :readonly="readonly"
              @update:model-value="draft = { ...draft!, summary: $event }"
            />
            <UiSelect
              id="campaign-template"
              :model-value="draft.templateId ?? ''"
              :label="t('cmp.field.template')"
              :options="templateOptions"
              :placeholder="t('cmp.template.choose')"
              :hint="templateHint"
              :disabled="readonly"
              @update:model-value="chooseTemplate"
            />
          </UiCard>

          <PrizeEditor
            :prizes="draft.prizes"
            :pool="draft.settings.pool ?? null"
            :joined="isDraft ? null : draft.participantCount"
            :readonly="readonly"
            @update:pool="setPool"
            @add="addNewPrize"
            @update="(prizeId, patch) => setPrizes(updatePrize(draft!.prizes, prizeId, patch))"
            @move="(prizeId, direction) => setPrizes(movePrize(draft!.prizes, prizeId, direction))"
            @remove="(prizeId) => setPrizes(removePrize(draft!.prizes, prizeId))"
          />

          <ContentEditor
            :template="draft.template"
            :fields="draft.fields"
            :settings="draft.settings"
            :readonly="readonly"
            :show-problems="showProblems"
            @update:fields="setFields"
            @update:settings="setSettings"
          />

          <UiCard as="section" aria-labelledby="schedule-title" class="schedule">
            <h2 id="schedule-title" class="ui-text-h3">{{ t('cmp.schedule') }}</h2>
            <UiCheckbox
              id="campaign-start-now"
              v-model="startNow"
              :label="t('cmp.startNow')"
              :disabled="readonly"
            />
            <UiDateTimeField
              v-if="!startNow"
              :model-value="startParts"
              :legend="t('cmp.start')"
              :zones="zones"
              @update:model-value="!readonly && setStart($event)"
            />
            <UiDateTimeField
              :model-value="endParts"
              :legend="t('cmp.end')"
              :zones="zones"
              :hint="t('cmp.end.hint')"
              @update:model-value="!readonly && setEnd($event)"
            />
          </UiCard>
        </div>

        <aside class="layout__side">
          <UiCard as="section" aria-labelledby="campaign-preview-title" class="preview">
            <div class="preview__head">
              <h2 id="campaign-preview-title" class="ui-text-h3">{{ t('cmp.preview') }}</h2>
              <UiSegmentedControl
                v-model="device"
                :label="t('cmp.preview.device')"
                :options="deviceOptions"
              />
            </div>
            <CampaignPagePreview
              :title="draft.title"
              :summary="draft.summary"
              :end-at="draft.endAt"
              :prizes="draft.prizes"
              :pool="draft.settings.pool ?? null"
              :kicker="kicker"
              :blocks="draft.fields"
              :has-template="draft.template !== null"
              :zone="zone"
              :device="device === 'desktop' ? 'desktop' : 'mobile'"
            />
            <p class="ui-text-caption ui-text-hint">
              <template v-if="draft.slug"
                >{{ t('cmp.preview.address', { slug: draft.slug }) }} ·
              </template>
              {{ t('cmp.preview.notPublic') }}
            </p>
          </UiCard>
          <CampaignChecks v-if="isDraft" :checks="checks" />
        </aside>
      </div>

      <UiConfirmDialog
        v-model:open="discardOpen"
        variant="destructive"
        :title="t('cmp.discard.title')"
        :consequence="t('cmp.discard.consequence')"
        :confirm-label="t('cmp.discard')"
        @confirm="leave"
      />
      <UiConfirmDialog
        v-model:open="toDraftOpen"
        :title="t('cmp.toDraft.title')"
        :consequence="t('cmp.toDraft.consequence')"
        :confirm-label="t('cmp.toDraft')"
        :loading="busy"
        @confirm="returnToDraft"
      />
      <UiConfirmDialog
        v-model:open="cancelOpen"
        variant="destructive"
        :title="t('cmp.cancel.title')"
        :consequence="t('cmp.cancel.consequence')"
        :confirm-label="t('cmp.cancel')"
        :loading="busy"
        @confirm="cancel"
      />
    </template>
  </BusinessShell>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  margin-block: var(--ui-space-4) var(--ui-space-6);
}
.head__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
}
.head__title h1 {
  margin: 0;
}
.head__actions,
.conflict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-space-6);
  margin-block-start: var(--ui-space-6);
}
@media (min-width: 1024px) {
  .layout {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }
  .layout__side {
    position: sticky;
    inset-block-start: calc(var(--ui-space-12) + var(--ui-space-4));
  }
}
.layout__main,
.layout__side {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.details,
.schedule {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.schedule h2 {
  margin: 0;
}
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.preview__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.preview h2,
.preview p {
  margin: 0;
}
</style>
