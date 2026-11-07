<script setup lang="ts">
import { ref } from 'vue';
import { useToast } from '../../composables/useToast';
import UiBanner from '../../components/UiBanner.vue';
import UiButton from '../../components/UiButton.vue';
import UiEmptyState from '../../components/UiEmptyState.vue';
import UiMeter from '../../components/UiMeter.vue';
import UiSkeleton from '../../components/UiSkeleton.vue';
import UiStatusChip from '../../components/UiStatusChip.vue';
import UiSystemState from '../../components/UiSystemState.vue';
import { statusVocabularies, type StatusVocabulary } from '../../status-vocabulary';
import UiBadge from '../../components/UiBadge.vue';
import GalleryBlock from '../GalleryBlock.vue';

const vocabularies = Object.keys(statusVocabularies) as StatusVocabulary[];
const toast = useToast();
const dismissed = ref(false);
</script>

<template>
  <GalleryBlock name="UiStatusChip">
    <div v-for="v in vocabularies" :key="v" class="demo-vocab">
      <p class="ui-text-caption">{{ v }}</p>
      <div class="demo-row">
        <UiStatusChip
          v-for="code in Object.keys(statusVocabularies[v])"
          :key="code"
          :vocabulary="v"
          :status="code"
        />
      </div>
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiBanner">
    <UiBanner tone="info"
      >Reports are generated in the background; we'll notify you when they're ready.</UiBanner
    >
    <UiBanner tone="warning" title="You've used 80% of this month's participants."
      >Contact a Business Owner to raise your limit.</UiBanner
    >
    <UiBanner tone="error" title="We couldn't save your changes."
      >Check your connection, then try again.
      <template #actions><UiButton variant="secondary">Try saving again</UiButton></template>
    </UiBanner>
    <UiBanner tone="system">Scheduled maintenance tonight at 22:00 GMT.</UiBanner>
    <UiBanner tone="elevation" title="Elevated access: Acme Ltd | Read-only | 03:12 remaining">
      <template #actions><UiButton variant="secondary">End elevation</UiButton></template>
    </UiBanner>
    <UiBanner v-if="!dismissed" tone="info" dismissible @dismiss="dismissed = true"
      >A dismissible notice.</UiBanner
    >
  </GalleryBlock>

  <GalleryBlock name="UiToaster">
    <div class="demo-row">
      <UiButton variant="secondary" @click="toast.push('Campaign saved.')"
        >Show success toast</UiButton
      >
      <UiButton variant="secondary" @click="toast.push('Report requested.', 'info')"
        >Show info toast</UiButton
      >
    </div>
    <p class="ui-text-body-s ui-text-hint">
      Auto-dismiss after 6 s; pauses on hover and focus. Errors use a banner or inline message.
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiEmptyState">
    <UiEmptyState
      icon="box"
      title="No campaigns yet"
      description="Create your first campaign to start collecting entries."
      ><UiButton icon="plus">Create campaign</UiButton></UiEmptyState
    >
    <UiEmptyState icon="search" title="No campaigns match these filters." :heading-level="3"
      ><UiButton variant="secondary">Clear filters</UiButton></UiEmptyState
    >
  </GalleryBlock>

  <GalleryBlock name="UiSkeleton">
    <div class="demo-grid">
      <UiSkeleton variant="text" />
      <UiSkeleton variant="card" />
      <UiSkeleton variant="form" />
      <UiSkeleton variant="table" :rows="3" />
      <UiSkeleton variant="chart" />
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiSystemState">
    <UiSystemState kind="forbidden" />
    <UiSystemState kind="rateLimited" :params="{ time: '0:45' }" />
    <UiSystemState kind="offline" />
    <p class="ui-text-body-s"><a href="/ui/states">See all 19 states in the matrix.</a></p>
  </GalleryBlock>

  <GalleryBlock name="UiMeter">
    <UiMeter label="Monthly participants" :used="42000" :limit="100000" />
    <UiMeter label="SMS spend today" :used="82" :limit="100" unit="GHS" />
    <UiMeter label="Storage" :used="5" :limit="5" unit="GB" />
  </GalleryBlock>

  <GalleryBlock name="UiBadge">
    <div class="demo-row">
      <UiBadge>Neutral</UiBadge>
      <UiBadge tone="info" icon="info">Info</UiBadge>
      <UiBadge tone="success" icon="check-circle">Success</UiBadge>
      <UiBadge tone="warning" icon="alert-triangle">Warning</UiBadge>
      <UiBadge tone="danger" icon="x-circle">Danger</UiBadge>
    </div>
    <div class="demo-row">
      <UiBadge shape="pill" icon="shield-check" tone="info">Business sign in</UiBadge>
      <UiBadge shape="pill" icon="clock" tone="info">2 days left</UiBadge>
      <UiBadge variant="outline" icon="gift">Giveaway</UiBadge>
    </div>
  </GalleryBlock>
</template>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.demo-vocab p {
  margin: 0 0 var(--ui-space-1);
}
.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-6);
}
</style>
