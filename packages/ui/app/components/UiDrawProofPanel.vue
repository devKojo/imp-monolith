<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiCard from './UiCard.vue';
import UiCopyButton from './UiCopyButton.vue';

export type DrawProof = {
  algorithm: string;
  eligibleCount: number;
  snapshotHash: string;
  seedCommitment: string;
  revealedSeed: string;
  verifySteps: string[];
};

/**
 * Draw proof (UI-RWD-03): algorithm and version, snapshot hash, seed commitment, revealed seed,
 * copy buttons, a plain-language verification path and a downloadable proof file. Hashes are shown
 * in full (monospace, wrapping) so they can be compared by eye or copied.
 */
defineProps<{ proof: DrawProof }>();
const emit = defineEmits<{ downloadSnapshot: []; downloadProof: [] }>();
</script>

<template>
  <UiCard as="section" :title="uiText('proof.title')" :heading-level="2">
    <dl class="ui-proof">
      <div class="ui-proof__row">
        <dt>{{ uiText('proof.algorithm') }}</dt>
        <dd>{{ proof.algorithm }}</dd>
      </div>
      <div class="ui-proof__row">
        <dt>{{ uiText('proof.eligible') }}</dt>
        <dd>{{ proof.eligibleCount.toLocaleString() }}</dd>
      </div>
      <div class="ui-proof__row">
        <dt>{{ uiText('proof.snapshot') }}</dt>
        <dd>
          <code>{{ proof.snapshotHash }}</code>
          <UiCopyButton :value="proof.snapshotHash" what="snapshot hash" />
          <UiButton variant="tertiary" icon="download" @click="emit('downloadSnapshot')">{{
            uiText('proof.downloadSnapshot')
          }}</UiButton>
        </dd>
      </div>
      <div class="ui-proof__row">
        <dt>{{ uiText('proof.commitment') }}</dt>
        <dd>
          <code>{{ proof.seedCommitment }}</code>
          <UiCopyButton :value="proof.seedCommitment" what="seed commitment" />
          <span class="ui-text-body-s ui-text-hint">{{ uiText('proof.published') }}</span>
        </dd>
      </div>
      <div class="ui-proof__row">
        <dt>{{ uiText('proof.seed') }}</dt>
        <dd>
          <code>{{ proof.revealedSeed }}</code>
          <UiCopyButton :value="proof.revealedSeed" what="revealed seed" />
        </dd>
      </div>
      <div class="ui-proof__row">
        <dt>{{ uiText('proof.verify') }}</dt>
        <dd>
          <ol class="ui-proof__steps">
            <li v-for="s in proof.verifySteps" :key="s">{{ s }}</li>
          </ol>
        </dd>
      </div>
    </dl>
    <UiButton icon="download" @click="emit('downloadProof')">{{
      uiText('proof.download')
    }}</UiButton>
  </UiCard>
</template>

<style scoped>
.ui-proof {
  display: grid;
  gap: var(--ui-space-3);
  margin: 0 0 var(--ui-space-4);
}
.ui-proof__row {
  display: grid;
  gap: var(--ui-space-1);
}
@media (min-width: 768px) {
  .ui-proof__row {
    grid-template-columns: calc(var(--ui-space-12) * 4) 1fr;
  }
}
dt {
  font-weight: 600;
  color: var(--ui-color-text-secondary);
}
dd {
  margin: 0;
}
code {
  overflow-wrap: anywhere;
  font-size: var(--ui-font-body-s-size);
}
.ui-proof__steps {
  margin: 0;
  padding-inline-start: var(--ui-space-5);
}
</style>
