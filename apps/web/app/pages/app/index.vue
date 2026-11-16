<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { SIGNIN } from '../../modules/auth/constants';
import BusinessShell from '../../modules/business/components/BusinessShell.vue';
import { classifyAuthError, toApiError, type AuthFailure } from '../../modules/auth/errors';
import { ROLE_LABELS } from '../../modules/auth/validation';
import { campaignErrorKey } from '../../modules/campaigns/errors';
import { browserZone } from '../../modules/campaigns/logic';
import type { CampaignSummary } from '../../modules/campaigns/types';
import { useCampaigns } from '../../modules/campaigns/useCampaigns';
import { CONSOLE_PAGE_SIZE, pageSlice } from '../../utils/paginate';
import type { ParticipantSummary } from '../../modules/participants/types';
import { useParticipants } from '../../modules/participants/useParticipants';

/**
 * Business console (client-rendered, no-store: private data never passes the SSR tier). Who you
 * are, the active business (derived by the server from the session's membership), switching
 * business, signing out and the campaigns shown here are all real, read from the campaigns API.
 * Figures with no backing feature yet (draw health, the next draw) are not shown. The participants
 * figure comes from the participants API and is shown only to roles that may see participants.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('console.title') });

const auth = useAuth();
const session = auth.session;
const store = useCampaigns();
const people = useParticipants();
const zone = browserZone();
const failure = ref<AuthFailure | null>(null);
const switching = ref(false);

const selected = ref(session.value?.active?.membershipId ?? '');
const options = computed(
  () =>
    session.value?.memberships.map((m) => ({
      value: m.membershipId,
      label: `${m.businessName} (${ROLE_LABELS[m.role] ?? m.role})`,
    })) ?? [],
);

// ---- the campaigns of the active business
const items = ref<CampaignSummary[]>([]);
const loading = ref(true);
const loadFailed = ref(false);
async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    items.value = await store.list();
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

// ---- participants: a headline figure, only for roles that may see them. A failure leaves a dash.
const participants = ref<ParticipantSummary | null>(null);
async function loadParticipants() {
  participants.value = null;
  if (!people.canView.value) return;
  participants.value = await people.summary().catch(() => null);
}
onMounted(() => {
  void load();
  void loadParticipants();
});

const count = (s: CampaignSummary['status']) => items.value.filter((c) => c.status === s).length;
const live = computed(() => count('LIVE'));
const scheduled = computed(() => count('SCHEDULED'));
const drafts = computed(() => count('DRAFT'));

const query = ref('');
const status = ref('all');
const statusOptions = [
  { value: 'all', label: t('cmp.filter.all') },
  { value: 'draft', label: t('cmp.filter.draft') },
  { value: 'scheduled', label: t('cmp.filter.scheduled') },
  { value: 'live', label: t('cmp.filter.live') },
  { value: 'paused', label: t('cmp.filter.paused') },
  { value: 'ended', label: t('cmp.filter.ended') },
];
const columns = [
  { key: 'name', label: t('console.table.campaign') },
  { key: 'type', label: t('console.table.type'), priority: 'medium' as const },
  { key: 'status', label: t('console.table.statusCol') },
  { key: 'closes', label: t('cmp.col.closes'), priority: 'medium' as const },
  { key: 'actions', label: t('console.table.actions') },
];
const matchesStatus = (c: CampaignSummary) =>
  status.value === 'all' ||
  (status.value === 'ended'
    ? c.status === 'COMPLETED' || c.status === 'CANCELLED'
    : c.status.toLowerCase() === status.value);
const rows = computed(() =>
  items.value
    .filter(
      (c) =>
        matchesStatus(c) &&
        (!query.value || c.title.toLowerCase().includes(query.value.trim().toLowerCase())),
    )
    .map((c) => ({
      id: c.id,
      name: c.title,
      type: c.template
        ? t(`tpl.archetype.${c.template.archetype}` as AppTextKey)
        : t('cmp.noTemplate'),
      status: c.status,
      closes: c.endAt ? formatInZone(new Date(c.endAt), zone) : t('cmp.noClose'),
    })),
);
const page = ref(1);
const pageRows = computed(() => pageSlice(rows.value, page.value));
watch([query, status], () => (page.value = 1));
const filtering = computed(() => query.value.trim() !== '' || status.value !== 'all');
const actionLabel = (s: string) =>
  s === 'DRAFT' ? t('console.table.edit') : t('console.table.view');

// ---- starting a campaign
const problem = ref('');
const creating = ref(false);
async function createNew() {
  problem.value = '';
  creating.value = true;
  try {
    const created = await store.create(t('cmp.newTitle'));
    await navigateTo(`/app/campaigns/${created.id}`);
  } catch (e) {
    problem.value = t(campaignErrorKey(toApiError(e)));
  } finally {
    creating.value = false;
  }
}

async function onSwitch(membershipId: string) {
  if (membershipId === session.value?.active?.membershipId) return;
  failure.value = null;
  switching.value = true;
  try {
    await auth.switchTenant(membershipId);
    await Promise.all([load(), loadParticipants()]); // both belong to the business that is now active
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    if (f.kind === 'unauthenticated') await navigateTo(SIGNIN.business);
    failure.value = f;
    selected.value = session.value?.active?.membershipId ?? '';
  } finally {
    switching.value = false;
  }
}
</script>

<template>
  <BusinessShell current="overview">
    <template #search>
      <UiSearchField v-model="query" :label="t('console.search')" />
    </template>
    <template #actions>
      <UiButton
        v-if="store.canManage.value"
        size="xs"
        icon="plus"
        :loading="creating"
        :loading-label="t('cmp.creating')"
        @click="createNew"
      >
        {{ t('console.create') }}
      </UiButton>
    </template>

    <UiSystemState v-if="failure" kind="generic" />
    <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

    <header class="page-head">
      <h1 class="ui-text-h1 page-head__title">{{ t('console.title') }}</h1>
      <UiSelect
        v-if="options.length > 1"
        v-model="selected"
        :label="t('console.switch')"
        :options="options"
        :disabled="switching"
        @update:model-value="onSwitch"
      />
    </header>

    <UiSystemState v-if="loadFailed" kind="generic" @action="load" />

    <template v-else>
      <section class="stats">
        <UiStatCard
          :label="t('console.stat.campaigns')"
          :value="loading ? '-' : t('console.stat.live', { n: live })"
          :suffix="loading ? '' : t('console.stat.ofTotal', { n: items.length })"
        />
        <UiStatCard
          :label="t('console.stat.scheduledLabel')"
          :value="loading ? '-' : String(scheduled)"
        />
        <UiStatCard
          :label="t('console.stat.draftsLabel')"
          :value="loading ? '-' : String(drafts)"
        />
        <UiStatCard
          v-if="people.canView.value"
          :label="t('console.stat.participants')"
          :value="participants ? String(participants.participants) : '-'"
          :suffix="
            participants ? t('console.stat.participants.suffix', { n: participants.completed }) : ''
          "
          icon="users"
        />
      </section>

      <section class="table-card" aria-labelledby="campaigns-title">
        <div class="table-card__head">
          <h2 id="campaigns-title" class="ui-text-h3">
            {{ t('console.table.title') }}
            <span class="ui-text-hint ui-text-body-s">({{ items.length }})</span>
          </h2>
          <UiSegmentedControl
            v-model="status"
            :label="t('console.table.status')"
            :options="statusOptions"
          />
        </div>
        <UiSkeleton v-if="loading" variant="card" />
        <UiDataTable
          v-else
          flush
          :name="t('console.table.title')"
          :columns="columns"
          :rows="pageRows"
          row-key="id"
        >
          <template #foot>
            <UiPagination
              v-model:page="page"
              :total="rows.length"
              :page-size="CONSOLE_PAGE_SIZE"
              :label="t('console.table.title')"
            />
          </template>
          <template #cell-name="{ row }">
            <strong class="ui-text-label">{{ row.name }}</strong>
          </template>
          <template #cell-status="{ row }">
            <UiStatusChip vocabulary="campaign" :status="String(row.status)" />
          </template>
          <template #cell-actions="{ row }">
            <UiButton :to="`/app/campaigns/${row.id}`" variant="tertiary" size="xs">
              {{ actionLabel(String(row.status)) }}
            </UiButton>
          </template>
          <template #empty>
            <UiEmptyState
              v-if="filtering"
              :title="t('console.table.empty.title')"
              :description="t('console.table.empty.body')"
            />
            <UiEmptyState
              v-else
              :title="t('console.table.none.title')"
              :description="t('console.table.none.body')"
            >
              <UiButton v-if="store.canManage.value" size="xs" icon="plus" @click="createNew">
                {{ t('console.create') }}
              </UiButton>
            </UiEmptyState>
          </template>
        </UiDataTable>
      </section>
    </template>
  </BusinessShell>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
@media (min-width: 768px) {
  .stats {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
}
.table-card {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
}
.table-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-5) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.table-card__head h2 {
  margin: 0;
}
</style>
