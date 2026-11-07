<script setup lang="ts">
import { ref } from 'vue';
import UiAccordion from '../../components/UiAccordion.vue';
import UiBanner from '../../components/UiBanner.vue';
import UiBreadcrumbs from '../../components/UiBreadcrumbs.vue';
import UiButton from '../../components/UiButton.vue';
import UiDashboardShell from '../../components/UiDashboardShell.vue';
import UiPublicShell from '../../components/UiPublicShell.vue';
import UiSidebarNav from '../../components/UiSidebarNav.vue';
import UiSkipLink from '../../components/UiSkipLink.vue';
import UiStepper, { type Step } from '../../components/UiStepper.vue';
import UiTabs from '../../components/UiTabs.vue';
import UiTopBar from '../../components/UiTopBar.vue';
import type { NavItem } from '../../components/UiSidebarNav.vue';
import UiAuthShell from '../../components/UiAuthShell.vue';
import UiBadge from '../../components/UiBadge.vue';
import UiDivider from '../../components/UiDivider.vue';
import UiLink from '../../components/UiLink.vue';
import UiPasswordField from '../../components/UiPasswordField.vue';
import UiTextInput from '../../components/UiTextInput.vue';
import GalleryBlock from '../GalleryBlock.vue';

const tab = ref('overview');
const stage = ref('config');
const stages: Step[] = [
  { id: 'details', label: 'Details', status: 'complete' },
  { id: 'dates', label: 'Dates and settings', status: 'complete' },
  { id: 'type', label: 'Experience selection', status: 'complete' },
  { id: 'config', label: 'Experience configuration', status: 'inProgress' },
  { id: 'rewards', label: 'Rewards and rules', status: 'issues' },
  { id: 'landing', label: 'Landing page and media', status: 'issues' },
  { id: 'preview', label: 'Preview and validation' },
  { id: 'publish', label: 'Publish or schedule' },
];
const flow: Step[] = [
  { id: 'a', label: 'Details' },
  { id: 'b', label: 'Verify' },
  { id: 'c', label: 'Enter' },
];
const nav: NavItem[] = [
  { label: 'Overview', to: '/ui/screens#overview', icon: 'globe' },
  { label: 'Campaigns', to: '/ui/screens#campaigns', icon: 'box', current: true },
  { label: 'Participants', to: '/ui/screens#participants', icon: 'user' },
  { label: 'Reports', to: '/ui/screens#reports', icon: 'download', badge: '2' },
];
const locale = ref('en');

const authEmail = ref('');
const authPassword = ref('');
</script>

<template>
  <GalleryBlock name="UiStepper">
    <UiStepper :steps="flow" current="b" />
    <UiStepper :steps="stages" :current="stage" mode="builder" @select="stage = $event" />
  </GalleryBlock>

  <GalleryBlock name="UiTabs">
    <UiTabs
      v-model="tab"
      label="Campaign sections"
      :tabs="[
        { id: 'overview', label: 'Overview' },
        { id: 'participants', label: 'Participants' },
        { id: 'analytics', label: 'Analytics' },
      ]"
    >
      <template #panel-overview>Overview content. Use arrow keys to move between tabs.</template>
      <template #panel-participants>Participants content.</template>
      <template #panel-analytics>Analytics content.</template>
    </UiTabs>
  </GalleryBlock>

  <GalleryBlock name="UiAccordion">
    <UiAccordion
      :items="[
        { id: 'how', title: 'How it works' },
        { id: 'prizes', title: 'Prizes' },
      ]"
      :open-ids="['how']"
    >
      <template #item-how>Answer the questions, verify your number, and you are entered.</template>
      <template #item-prizes>A weekend getaway for two.</template>
    </UiAccordion>
  </GalleryBlock>

  <GalleryBlock name="UiBreadcrumbs">
    <UiBreadcrumbs
      :items="[
        { label: 'Campaigns', to: '/ui/screens#campaigns' },
        { label: 'Black Friday Quiz', to: '/ui/screens#detail' },
        { label: 'Participants' },
      ]"
    />
  </GalleryBlock>

  <GalleryBlock name="UiSidebarNav">
    <div class="demo-narrow"><UiSidebarNav :items="nav" /></div>
  </GalleryBlock>

  <GalleryBlock name="UiTopBar">
    <UiTopBar
      business-name="Acme Ltd"
      role-label="Owner"
      user-name="A. Mensah"
      :unread="3"
      show-menu
    />
  </GalleryBlock>

  <GalleryBlock name="UiSkipLink">
    <p class="ui-text-body-s">
      It is the first focusable element on every page (press Tab right after the page loads in the
      gallery to see it).
    </p>
    <UiSkipLink target="#main" />
  </GalleryBlock>

  <GalleryBlock name="UiDashboardShell">
    <div class="demo-frame">
      <UiDashboardShell
        business-name="Acme Ltd"
        role-label="Owner"
        user-name="A. Mensah"
        :nav="nav"
        :unread="3"
      >
        <template #banner
          ><UiBanner
            tone="elevation"
            title="Elevated access: Acme Ltd | Read-only | 03:12 remaining"
            ><template #actions
              ><UiButton variant="secondary">End elevation</UiButton></template
            ></UiBanner
          ></template
        >
        <template #breadcrumbs
          ><UiBreadcrumbs
            :items="[{ label: 'Campaigns', to: '/ui/screens#campaigns' }, { label: 'List' }]"
        /></template>
        <p>Page content renders inside the single main landmark.</p>
      </UiDashboardShell>
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiPublicShell">
    <div class="demo-frame">
      <UiPublicShell
        v-model:locale="locale"
        brand-name="Acme Ltd"
        :locales="[
          { value: 'en', label: 'English' },
          { value: 'tw', label: 'Twi' },
        ]"
      >
        <h2 class="ui-text-h2">Win a weekend for two</h2>
        <p>
          Content in the reading column. The footer always has Privacy, Terms, Help and Report
          abuse.
        </p>
      </UiPublicShell>
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiAuthShell">
    <div class="demo-frame">
      <UiAuthShell
        brand-name="Acme Ltd"
        title="Welcome back"
        subtitle="Sign in to manage your campaigns."
      >
        <template #badge
          ><UiBadge shape="pill" tone="info" icon="shield-check"
            >Business sign in</UiBadge
          ></template
        >
        <UiTextInput
          v-model="authEmail"
          label="Email address"
          type="email"
          icon="mail"
          autocomplete="email"
        />
        <UiPasswordField v-model="authPassword" label="Password" autocomplete="current-password" />
        <UiDivider label="or" />
        <UiButton block icon-trailing="arrow-right">Sign in</UiButton>
        <template #footer
          >Don't have an account? <UiLink to="/ui/screens">Create an account</UiLink></template
        >
        <template #below>Your session ends after 30 minutes of inactivity.</template>
      </UiAuthShell>
    </div>
  </GalleryBlock>
</template>

<style scoped>
.demo-narrow {
  max-inline-size: calc(var(--ui-space-12) * 6);
}
.demo-frame {
  overflow: hidden;
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-md);
}
</style>
