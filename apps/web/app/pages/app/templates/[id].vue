<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from '@imp/ui/app/composables/useToast';
import { t, type AppTextKey } from '../../../i18n';
import { toApiError } from '../../../modules/auth/errors';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import BlockInspector from '../../../modules/templates/components/BlockInspector.vue';
import BlockPalette from '../../../modules/templates/components/BlockPalette.vue';
import BlockPipeline from '../../../modules/templates/components/BlockPipeline.vue';
import ParticipantPreview from '../../../modules/templates/components/ParticipantPreview.vue';
import PreflightList from '../../../modules/templates/components/PreflightList.vue';
import { templateErrorKey } from '../../../modules/templates/errors';
import {
  LIMITS,
  clone,
  createBlock,
  currentStage,
  duplicateBlock,
  isPublishable,
  moveBlock,
  preflight,
  removeBlock,
  stageStatuses,
  updateBlock,
} from '../../../modules/templates/logic';
import { useTemplates } from '../../../modules/templates/useTemplates';
import {
  ARCHETYPES,
  type Archetype,
  type BlockKind,
  type CampaignTemplate,
  type StageId,
  type TemplateBlock,
} from '../../../modules/templates/types';

/**
 * Template builder. The page edits a working copy of the template it loaded from the API: Save
 * sends it back with the version it read, Discard throws it away. A published template, or a role
 * that cannot change templates, sees it read-only. Everything that can be derived (checks, stage,
 * whether it can be published) is computed from the working copy; the server runs the same checks
 * again when publishing and has the last word.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });

const route = useRoute();
const id = String(route.params.id);
const store = useTemplates();
const toast = useToast();

const state = ref<'loading' | 'ready' | 'notfound' | 'error'>('loading');
const draft = ref<CampaignTemplate | null>(null);
const savedJson = ref('');
const dirty = computed(
  () => draft.value !== null && JSON.stringify(draft.value) !== savedJson.value,
);
const saving = ref(false);
const problem = ref('');
const conflict = ref(false);

useHead({ title: computed(() => draft.value?.name || t('tpl.title')) });

const selectedId = ref<string | null>(null);
const selected = computed(() => draft.value?.blocks.find((b) => b.id === selectedId.value) ?? null);
const blocks = computed(() => draft.value?.blocks ?? []);

const locked = computed(() => draft.value?.status === 'PUBLISHED');
const readonly = computed(() => locked.value || !store.canManage.value);
const nameProblem = computed(() =>
  draft.value && draft.value.name.trim() === '' ? t('tpl.name.required') : undefined,
);

const checks = computed(() => preflight(blocks.value));
const publishable = computed(() => isPublishable(blocks.value) && !nameProblem.value);
const statuses = computed(() => (draft.value ? stageStatuses(draft.value) : null));
const stage = computed<StageId>(() => (statuses.value ? currentStage(statuses.value) : 'fields'));
const steps = computed(() =>
  (['archetype', 'fields', 'checks', 'publish'] as const).map((s) => ({
    id: s,
    label: t(`tpl.stage.${s}` as AppTextKey),
    ...(statuses.value ? { status: statuses.value[s] } : {}),
  })),
);

const archetypeOptions = ARCHETYPES.map((a) => ({
  value: a,
  label: t(`tpl.archetype.${a}` as AppTextKey),
}));

const device = ref('mobile');
const deviceOptions = [
  { value: 'mobile', label: t('tpl.device.mobile') },
  { value: 'desktop', label: t('tpl.device.desktop') },
];

async function load() {
  state.value = 'loading';
  problem.value = '';
  conflict.value = false;
  try {
    const loaded = await store.get(id);
    draft.value = clone(loaded);
    savedJson.value = JSON.stringify(loaded);
    selectedId.value = null;
    state.value = 'ready';
  } catch (e) {
    state.value = toApiError(e).status === 404 ? 'notfound' : 'error';
  }
}
onMounted(load);

/** Adopt what the server stored, keeping the selected field selected (its id changes on save). */
function adopt(next: CampaignTemplate) {
  const key = selected.value?.key;
  draft.value = clone(next);
  savedJson.value = JSON.stringify(next);
  selectedId.value = next.blocks.find((b) => b.key === key)?.id ?? null;
}
function failed(e: unknown) {
  const err = toApiError(e);
  if (err.code === 'VERSION_CONFLICT') conflict.value = true;
  else problem.value = t(templateErrorKey(err));
}

const setBlocks = (next: TemplateBlock[]) => {
  if (draft.value) draft.value = { ...draft.value, blocks: next };
};
function addBlock(kind: BlockKind) {
  if (blocks.value.length >= LIMITS.fields) return;
  const block = createBlock(
    kind,
    t(`tpl.block.${kind}` as AppTextKey),
    crypto.randomUUID(),
    blocks.value,
  );
  setBlocks([...blocks.value, block]);
  selectedId.value = block.id;
}
function duplicate(blockId: string) {
  if (blocks.value.length >= LIMITS.fields) return;
  const newId = crypto.randomUUID();
  setBlocks(duplicateBlock(blocks.value, blockId, newId));
  selectedId.value = newId;
}
function remove(blockId: string) {
  setBlocks(removeBlock(blocks.value, blockId));
  if (selectedId.value === blockId) selectedId.value = null;
}
const patchSelected = (patch: Parameters<typeof updateBlock>[2]) => {
  if (selectedId.value) setBlocks(updateBlock(blocks.value, selectedId.value, patch));
};

async function save(): Promise<boolean> {
  if (!draft.value || saving.value || nameProblem.value) return false;
  problem.value = '';
  conflict.value = false;
  saving.value = true;
  try {
    adopt(await store.save(draft.value));
    toast.push(t('tpl.saved'));
    return true;
  } catch (e) {
    failed(e);
    return false;
  } finally {
    saving.value = false;
  }
}
async function publish() {
  if (!draft.value || !publishable.value || saving.value) return;
  if (dirty.value && !(await save())) return;
  saving.value = true;
  try {
    adopt(await store.publish(draft.value!));
    toast.push(t('tpl.published'));
  } catch (e) {
    failed(e);
  } finally {
    saving.value = false;
  }
}
async function unpublish() {
  if (!draft.value || saving.value) return;
  problem.value = '';
  saving.value = true;
  try {
    adopt(await store.unpublish(draft.value));
    toast.push(t('tpl.unpublished'), 'info');
  } catch (e) {
    failed(e);
  } finally {
    saving.value = false;
  }
}

const discardOpen = ref(false);
const leave = () => navigateTo('/app/templates');
function close() {
  if (dirty.value) discardOpen.value = true;
  else void leave();
}
function goTo(stepId: string) {
  document
    .getElementById(`stage-${stepId}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const crumbs = computed(() => [
  { label: t('tpl.title'), to: '/app/templates' },
  { label: draft.value?.name || t('tpl.newName') },
]);
</script>

<template>
  <BusinessShell current="templates">
    <UiSkeleton v-if="state === 'loading'" variant="card" />

    <UiEmptyState
      v-else-if="state === 'notfound'"
      :title="t('tpl.notFound.title')"
      :description="t('tpl.notFound.body')"
    >
      <UiButton to="/app/templates" variant="secondary" size="xs">
        {{ t('tpl.notFound.back') }}
      </UiButton>
    </UiEmptyState>

    <UiSystemState v-else-if="state === 'error' || !draft" kind="generic" @action="load" />

    <template v-else>
      <UiBreadcrumbs :items="crumbs" />

      <header class="head">
        <div class="head__title">
          <h1 class="ui-text-h1">{{ draft.name || t('tpl.newName') }}</h1>
          <UiStatusChip vocabulary="template" :status="draft.status" />
          <span v-if="dirty" class="ui-text-caption ui-text-hint" role="status">
            {{ t('tpl.unsaved') }}
          </span>
        </div>
        <div id="stage-publish" class="head__actions">
          <UiButton variant="tertiary" size="xs" @click="close">
            {{ dirty ? t('tpl.discard') : t('tpl.close') }}
          </UiButton>
          <template v-if="store.canManage.value">
            <UiButton
              v-if="!locked"
              variant="secondary"
              size="xs"
              :loading="saving"
              :loading-label="t('tpl.saving')"
              :disabled="!dirty || !!nameProblem"
              @click="save"
            >
              {{ t('tpl.save') }}
            </UiButton>
            <UiButton
              v-if="locked"
              variant="secondary"
              size="xs"
              :disabled="saving"
              @click="unpublish"
            >
              {{ t('tpl.unpublish') }}
            </UiButton>
            <UiButton v-else size="xs" :disabled="!publishable || saving" @click="publish">
              {{ t('tpl.publish') }}
            </UiButton>
          </template>
        </div>
      </header>

      <p v-if="readonly" class="ui-text-caption ui-text-hint">
        {{ locked ? t('tpl.readonly.published') : t('tpl.readonly.role') }}
      </p>
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <UiBanner v-if="conflict" tone="warning" role="alert" :title="t('tpl.error.conflict')">
        <span class="conflict">
          <UiButton variant="secondary" size="xs" @click="load">{{ t('tpl.reload') }}</UiButton>
          <UiButton variant="tertiary" size="xs" @click="conflict = false">
            {{ t('tpl.keepEditing') }}
          </UiButton>
        </span>
      </UiBanner>

      <UiStepper
        mode="builder"
        :steps="steps"
        :current="stage"
        :aria-label="t('tpl.stages')"
        @select="goTo"
      />

      <div class="layout">
        <div class="layout__main">
          <UiCard id="stage-archetype" as="section" class="setup">
            <UiTextInput
              id="template-name"
              :model-value="draft.name"
              :label="t('tpl.name')"
              :maxlength="LIMITS.name"
              :readonly="readonly"
              :error="nameProblem"
              @update:model-value="draft = { ...draft!, name: $event }"
            />
            <UiSelect
              id="template-archetype"
              :model-value="draft.archetype"
              :label="t('tpl.archetype')"
              :options="archetypeOptions"
              :hint="t(`tpl.archetype.${draft.archetype}.desc` as AppTextKey)"
              :disabled="readonly"
              @update:model-value="draft = { ...draft!, archetype: $event as Archetype }"
            />
          </UiCard>

          <div id="stage-fields" class="stack">
            <BlockPalette v-if="!readonly" :full="blocks.length >= LIMITS.fields" @add="addBlock" />
            <BlockPipeline
              :blocks="blocks"
              :selected-id="selectedId"
              :readonly="readonly"
              @select="selectedId = $event"
              @move="(blockId, direction) => setBlocks(moveBlock(blocks, blockId, direction))"
              @duplicate="duplicate"
              @remove="remove"
            />
            <BlockInspector
              v-if="selected && !readonly"
              :block="selected"
              @update="patchSelected"
            />
          </div>
        </div>

        <aside class="layout__side">
          <UiCard as="section" aria-labelledby="preview-title" class="preview">
            <div class="preview__head">
              <h2 id="preview-title" class="ui-text-h3">{{ t('tpl.preview') }}</h2>
              <UiSegmentedControl
                v-model="device"
                :label="t('tpl.device')"
                :options="deviceOptions"
              />
            </div>
            <ParticipantPreview
              :name="draft.name || t('tpl.newName')"
              :blocks="blocks"
              :device="device === 'desktop' ? 'desktop' : 'mobile'"
            />
          </UiCard>
          <div id="stage-checks"><PreflightList :checks="checks" /></div>
        </aside>
      </div>

      <UiConfirmDialog
        v-model:open="discardOpen"
        variant="destructive"
        :title="t('tpl.discard.title')"
        :consequence="t('tpl.discard.consequence')"
        :confirm-label="t('tpl.discard')"
        @confirm="leave"
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
.layout__side,
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.setup {
  display: grid;
  gap: var(--ui-space-4);
}
@media (min-width: 640px) {
  .setup {
    grid-template-columns: 1fr 1fr;
  }
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
.preview h2 {
  margin: 0;
}
</style>
