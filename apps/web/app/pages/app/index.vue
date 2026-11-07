<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import { businessSample as sample } from '../../modules/business/sample';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { BRAND_NAME, SIGNIN } from '../../modules/auth/constants';
import { classifyAuthError, toApiError, type AuthFailure } from '../../modules/auth/errors';
import { ROLE_LABELS } from '../../modules/auth/validation';

/**
 * Business console (client-rendered, no-store: private data never passes the SSR tier). Who you
 * are, the active business (derived by the server from the session's membership), switching
 * business and signing out are real; campaign figures are labelled samples until those APIs exist.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('console.title') });

const auth = useAuth();
const session = auth.session;
const failure = ref<AuthFailure | null>(null);
const loggingOut = ref(false);
const switching = ref(false);

const active = computed(() =>
  session.value?.memberships.find((m) => m.membershipId === session.value?.active?.membershipId),
);
const roleLabel = computed(() =>
  active.value ? (ROLE_LABELS[active.value.role] ?? active.value.role) : '',
);
const selected = ref(session.value?.active?.membershipId ?? '');
const options = computed(
  () =>
    session.value?.memberships.map((m) => ({
      value: m.membershipId,
      label: `${m.businessName} (${ROLE_LABELS[m.role] ?? m.role})`,
    })) ?? [],
);

const nav = computed(() => [
  { label: t('console.nav.overview'), to: '/app', icon: 'grid' as const, current: true },
  { label: t('console.nav.campaigns'), to: '/app/campaigns', icon: 'rocket' as const },
  { label: t('console.nav.participants'), to: '/app/participants', icon: 'users' as const },
  { label: t('console.nav.analytics'), to: '/app/analytics', icon: 'trending-up' as const },
  { label: t('console.nav.settings'), to: '/app/settings', icon: 'sliders' as const },
]);

const query = ref('');
const status = ref('all');
const statusOptions = [
  { value: 'all', label: t('console.table.all') },
  { value: 'live', label: t('console.table.live') },
  { value: 'scheduled', label: t('console.table.scheduled') },
  { value: 'paused', label: t('console.table.paused') },
];
const columns = [
  { key: 'name', label: t('console.table.campaign') },
  { key: 'type', label: t('console.table.type'), priority: 'medium' as const },
  { key: 'status', label: t('console.table.statusCol') },
  { key: 'entries', label: t('console.table.entries'), priority: 'medium' as const },
  { key: 'actions', label: t('console.table.actions') },
];
const rows = computed(() =>
  sample.campaignRows.filter(
    (r) =>
      (status.value === 'all' || r.status.toLowerCase() === status.value) &&
      (!query.value ||
        `${r.name} ${r.detail} ${r.type}`.toLowerCase().includes(query.value.toLowerCase())),
  ),
);
const actionLabel = (s: string) =>
  s === 'PAUSED'
    ? t('console.table.resume')
    : s === 'SCHEDULED'
      ? t('console.table.edit')
      : t('console.table.view');

async function onSwitch(membershipId: string) {
  if (membershipId === session.value?.active?.membershipId) return;
  failure.value = null;
  switching.value = true;
  try {
    await auth.switchTenant(membershipId);
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    if (f.kind === 'unauthenticated') await navigateTo(SIGNIN.business);
    failure.value = f;
    selected.value = session.value?.active?.membershipId ?? '';
  } finally {
    switching.value = false;
  }
}

async function logout() {
  loggingOut.value = true;
  try {
    await auth.logout();
  } catch (e) {
    failure.value = classifyAuthError(toApiError(e));
  } finally {
    loggingOut.value = false;
  }
  if (!session.value) await navigateTo(SIGNIN.business);
}
</script>

<template>
  <UiConsoleShell
    v-if="session"
    :brand-name="BRAND_NAME"
    :nav="nav"
    :nav-label="t('console.nav.label')"
    :user-name="session.user.name"
    :user-role="active ? `${active.businessName} · ${roleLabel}` : roleLabel"
  >
    <template #search>
      <UiSearchField v-model="query" :label="t('console.search')" />
    </template>
    <template #actions>
      <UiButton
        variant="tertiary"
        icon="log-out"
        :loading="loggingOut"
        :loading-label="t('console.loggingOut')"
        @click="logout"
      >
        {{ t('console.logout') }}
      </UiButton>
      <UiButton icon="plus" disabled>{{ t('console.create') }}</UiButton>
    </template>

    <UiBanner tone="system" :title="t('console.sample.title')" class="gap-after">
      {{ t('console.sample.body') }}
    </UiBanner>
    <UiSystemState v-if="failure" kind="generic" />

    <header class="page-head">
      <div>
        <h1 class="page-head__title">{{ t('console.title') }}</h1>
        <p class="ui-text-body-s ui-text-secondary">{{ t('console.subtitle') }}</p>
      </div>
      <UiSelect
        v-if="options.length > 1"
        v-model="selected"
        :label="t('console.switch')"
        :options="options"
        :disabled="switching"
        @update:model-value="onSwitch"
      />
    </header>

    <section class="stats">
      <UiStatCard
        :label="t('console.stat.participants')"
        :value="sample.participants.value"
        :badge="sample.participants.change"
        badge-icon="arrow-up"
        icon="users"
        :footer="[{ label: t('console.stat.vsLast'), value: sample.participants.newCount }]"
      />
      <UiStatCard
        :label="t('console.stat.campaigns')"
        :value="t('console.stat.live', { n: sample.campaigns.live })"
        :suffix="t('console.stat.ofTotal', { n: sample.campaigns.total })"
        icon="rocket"
        :footer="[
          {
            label: sample.campaigns.nextLaunch,
            value: t('console.stat.scheduled', { n: sample.campaigns.scheduled }),
          },
        ]"
      />
      <UiStatCard
        :label="t('console.stat.health')"
        :value="sample.drawHealth.value"
        :badge="t('console.stat.verified')"
        badge-tone="info"
        icon="shield-check"
        :footer="[
          {
            label: t('console.stat.integrity'),
            value: t('console.stat.anomalies', { n: sample.drawHealth.anomalies }),
          },
        ]"
      />
    </section>

    <section class="draw">
      <UiIconTile icon="refresh" size="lg" />
      <div class="draw__text">
        <p class="draw__title">
          <strong class="ui-text-h3">{{ sample.nextDraw.title }}</strong>
          <UiBadge tone="info" shape="pill">{{ sample.nextDraw.countdown }}</UiBadge>
        </p>
        <p class="ui-text-body-s ui-text-secondary">
          {{
            t('console.draw.detail', {
              winners: sample.nextDraw.winners,
              pool: sample.nextDraw.pool,
            })
          }}
        </p>
      </div>
      <div class="draw__actions">
        <UiButton variant="secondary" disabled>{{ t('console.draw.preview') }}</UiButton>
        <UiButton disabled>{{ t('console.draw.execute') }}</UiButton>
      </div>
    </section>

    <section class="table-card" aria-labelledby="campaigns-title">
      <div class="table-card__head">
        <h2 id="campaigns-title" class="ui-text-h3">
          {{ t('console.table.title') }}
          <span class="ui-text-hint ui-text-body-s">({{ sample.campaigns.total }})</span>
        </h2>
        <UiSegmentedControl
          v-model="status"
          :label="t('console.table.status')"
          :options="statusOptions"
        />
      </div>
      <UiDataTable
        flush
        :name="t('console.table.title')"
        :columns="columns"
        :rows="rows"
        row-key="id"
      >
        <template #cell-name="{ row }">
          <span class="cell-name">
            <UiIconTile :icon="(row as (typeof sample.campaignRows)[number]).icon" tone="neutral" />
            <span>
              <strong class="ui-text-label">{{ row.name }}</strong>
              <br />
              <span class="ui-text-caption ui-text-hint">{{ row.detail }}</span>
            </span>
          </span>
        </template>
        <template #cell-status="{ row }">
          <UiStatusChip vocabulary="campaign" :status="String(row.status)" />
        </template>
        <template #cell-actions="{ row }">
          <UiButton variant="tertiary" disabled>{{ actionLabel(String(row.status)) }}</UiButton>
        </template>
        <template #empty>
          <UiEmptyState
            :title="t('console.table.empty.title')"
            :description="t('console.table.empty.body')"
          />
        </template>
      </UiDataTable>
    </section>
  </UiConsoleShell>
  <UiSkeleton v-else variant="card" />
</template>

<style scoped>
.gap-after {
  margin-block-end: var(--ui-space-6);
}
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.page-head p {
  margin: var(--ui-space-1) 0 0;
}
.page-head__title {
  margin: 0;
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 800;
  letter-spacing: -0.025em;
}
.stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-5);
  margin-block-end: var(--ui-space-8);
}
@media (min-width: 768px) {
  .stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
.draw {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
  padding: var(--ui-space-5) var(--ui-space-6);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-1);
}
.draw__text {
  flex: 1;
  min-inline-size: 240px;
}
.draw__text p {
  margin: 0;
}
.draw__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.draw__actions {
  display: flex;
  gap: var(--ui-space-3);
}
.table-card {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-1);
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
.cell-name {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-3);
}
</style>
