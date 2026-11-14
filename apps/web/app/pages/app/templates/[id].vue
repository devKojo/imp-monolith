<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from '@imp/ui/app/composables/useToast';
import { t, type AppTextKey } from '../../../i18n';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import BlockInspector from '../../../modules/templates/components/BlockInspector.vue';
import BlockPalette from '../../../modules/templates/components/BlockPalette.vue';
import BlockPipeline from '../../../modules/templates/components/BlockPipeline.vue';
import ParticipantPreview from '../../../modules/templates/components/ParticipantPreview.vue';
import PreflightList from '../../../modules/templates/components/PreflightList.vue';
import {
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
 * Template builder. The page edits a working copy of the template: Save writes it back, Discard
 * throws it away. Everything that can be derived (checks, stage, whether it can be published) is
 * computed from the working copy, so it cannot drift from what is on screen.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });

const route = useRoute();
const store = useTemplates();
const toast = useToast();

const stored = store.get(String(route.params.id));
const draft = ref<CampaignTemplate | null>(stored ? clone(stored) : null);
const savedJson = ref(JSON.stringify(draft.value));
const dirty = computed(() => JSON.stringify(draft.value) !== savedJson.value);

useHead({ title: computed(() => draft.value?.name || t('tpl.title')) });

const selectedId = ref<string | null>(null);
const selected = computed(() => draft.value?.blocks.find((b) => b.id === selectedId.value) ?? null);
const blocks = computed(() => draft.value?.blocks ?? []);
const checks = computed(() => preflight(blocks.value));
const publishable = computed(() => isPublishable(blocks.value));
const statuses = computed(() => (draft.value ? stageStatuses(draft.value) : null));
const stage = computed<StageId>(() => (statuses.value ? currentStage(statuses.value) : 'fields'));
const steps = computed(() =>
  (['archetype', 'fields', 'checks', 'publish'] as const).map((id) => ({
    id,
    label: t(`tpl.stage.${id}` as AppTextKey),
    ...(statuses.value ? { status: statuses.value[id] } : {}),
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

const setBlocks = (next: TemplateBlock[]) => {
  if (draft.value) draft.value = { ...draft.value, blocks: next };
};
function addBlock(kind: BlockKind) {
  const block = createBlock(
    kind,
    t(`tpl.block.${kind}` as AppTextKey),
    crypto.randomUUID(),
    blocks.value,
  );
  setBlocks([...blocks.value, block]);
  selectedId.value = block.id;
}
function duplicate(id: string) {
  const newId = crypto.randomUUID();
  setBlocks(duplicateBlock(blocks.value, id, newId));
  selectedId.value = newId;
}
function remove(id: string) {
  setBlocks(removeBlock(blocks.value, id));
  if (selectedId.value === id) selectedId.value = null;
}
const patchSelected = (patch: Parameters<typeof updateBlock>[2]) => {
  if (selectedId.value) setBlocks(updateBlock(blocks.value, selectedId.value, patch));
};

function persist() {
  if (!draft.value) return;
  store.save(draft.value);
  const fresh = store.get(draft.value.id);
  if (fresh) draft.value = clone(fresh);
  savedJson.value = JSON.stringify(draft.value);
}
function save() {
  persist();
  toast.push(t('tpl.saved'), 'success');
}
function publish() {
  if (!draft.value || !publishable.value) return;
  draft.value = { ...draft.value, status: 'PUBLISHED' };
  persist();
  toast.push(t('tpl.published'), 'success');
}
function unpublish() {
  if (!draft.value) return;
  draft.value = { ...draft.value, status: 'DRAFT' };
  persist();
  toast.push(t('tpl.unpublished'), 'info');
}

const discardOpen = ref(false);
const leave = () => navigateTo('/app/templates');
function discard() {
  if (dirty.value) discardOpen.value = true;
  else void leave();
}
function goTo(id: string) {
  document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const crumbs = computed(() => [
  { label: t('tpl.title'), to: '/app/templates' },
  { label: draft.value?.name || t('tpl.newName') },
]);
</script>

<template>
  <BusinessShell current="templates">
    <UiEmptyState
      v-if="!draft"
      :title="t('tpl.notFound.title')"
      :description="t('tpl.notFound.body')"
    >
      <UiButton to="/app/templates" variant="secondary" size="xs">
        {{ t('tpl.notFound.back') }}
      </UiButton>
    </UiEmptyState>

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
          <UiButton variant="tertiary" size="xs" @click="discard">{{ t('tpl.discard') }}</UiButton>
          <UiButton variant="secondary" size="xs" :disabled="!dirty" @click="save">
            {{ t('tpl.save') }}
          </UiButton>
          <UiButton
            v-if="draft.status === 'PUBLISHED'"
            variant="secondary"
            size="xs"
            @click="unpublish"
          >
            {{ t('tpl.unpublish') }}
          </UiButton>
          <UiButton v-else size="xs" :disabled="!publishable" @click="publish">
            {{ t('tpl.publish') }}
          </UiButton>
        </div>
      </header>

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
              @update:model-value="draft = { ...draft!, name: $event }"
            />
            <UiSelect
              id="template-archetype"
              :model-value="draft.archetype"
              :label="t('tpl.archetype')"
              :options="archetypeOptions"
              :hint="t(`tpl.archetype.${draft.archetype}.desc` as AppTextKey)"
              @update:model-value="draft = { ...draft!, archetype: $event as Archetype }"
            />
          </UiCard>

          <div id="stage-fields" class="stack">
            <BlockPalette @add="addBlock" />
            <BlockPipeline
              :blocks="blocks"
              :selected-id="selectedId"
              @select="selectedId = $event"
              @move="(id, direction) => setBlocks(moveBlock(blocks, id, direction))"
              @duplicate="duplicate"
              @remove="remove"
            />
            <BlockInspector v-if="selected" :block="selected" @update="patchSelected" />
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
.head__actions {
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
