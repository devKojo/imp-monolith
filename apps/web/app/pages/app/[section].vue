<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { BRAND_NAME } from '../../modules/auth/constants';
import { ROLE_LABELS } from '../../modules/auth/validation';

/** Console sections that are built in later releases: one honest "coming soon" page. */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('console.soon.title') });

const route = useRoute();
const session = useAuth().session;
const active = computed(() =>
  session.value?.memberships.find((m) => m.membershipId === session.value?.active?.membershipId),
);
const sections = ['campaigns', 'participants', 'analytics', 'settings'] as const;
const nav = computed(() => [
  { label: t('console.nav.overview'), to: '/app', icon: 'grid' as const },
  ...sections.map((s, i) => ({
    label: t(`console.nav.${s}` as const),
    to: `/app/${s}`,
    icon: (['rocket', 'users', 'trending-up', 'sliders'] as const)[i]!,
    current: route.params.section === s,
  })),
]);
</script>

<template>
  <UiConsoleShell
    v-if="session"
    :brand-name="BRAND_NAME"
    :nav="nav"
    :nav-label="t('console.nav.label')"
    :user-name="session.user.name"
    :user-role="active ? `${active.businessName} · ${ROLE_LABELS[active.role] ?? active.role}` : ''"
  >
    <UiEmptyState :title="t('console.soon.title')" :description="t('console.soon.body')">
      <UiButton to="/app" variant="secondary" size="xs">{{ t('console.soon.back') }}</UiButton>
    </UiEmptyState>
  </UiConsoleShell>
  <UiSkeleton v-else variant="card" />
</template>
