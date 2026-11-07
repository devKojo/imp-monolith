<script setup lang="ts">
import { ref } from 'vue';
import UiCountdown from '../../components/UiCountdown.vue';
import UiDrawProofPanel from '../../components/UiDrawProofPanel.vue';
import UiMediaUploader, { type UploadState } from '../../components/UiMediaUploader.vue';
import UiReorderableList from '../../components/UiReorderableList.vue';
import UiRewardCard from '../../components/UiRewardCard.vue';
import GalleryBlock from '../GalleryBlock.vue';

const questions = ref([
  { id: 'q1', label: 'What is the capital of Ghana?' },
  { id: 'q2', label: 'Which river is the longest in Ghana?' },
  { id: 'q3', label: 'When did Ghana gain independence?' },
]);
function move({ from, to }: { from: number; to: number }) {
  const list = [...questions.value];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item!);
  questions.value = list;
}
const remove = (id: string) => (questions.value = questions.value.filter((q) => q.id !== id));

const upload = ref<UploadState>('choosing');
const uploadStates: UploadState[] = ['choosing', 'uploading', 'validating', 'approved', 'rejected'];

const seconds = ref(30);
const proof = {
  algorithm: 'draw-v1 (HMAC-SHA-256 counter mode, rejection sampling)',
  eligibleCount: 12480,
  snapshotHash: '9f2c4e1a8b7d6c5e3f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e',
  seedCommitment: '44be0a1c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e03de',
  revealedSeed: '7a91c2f0e1d3b5a79c8e6f4d2b0a1c3e5f7a9b1d3c5e7f9a1b3d5c7e9f1a3b5c',
  verifySteps: [
    'Download the snapshot.',
    'Check its SHA-256 hash matches the snapshot hash.',
    'Check the seed hashes to the commitment, then follow the verification steps in the proof file.',
  ],
};
</script>

<template>
  <GalleryBlock name="UiReorderableList">
    <UiReorderableList
      :items="questions"
      label="Quiz questions"
      removable
      @move="move"
      @remove="remove"
    />
    <p class="ui-text-body-s ui-text-hint">
      The same pattern reorders answer options and landing-page blocks.
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiMediaUploader">
    <div class="demo-chips">
      <button
        v-for="s in uploadStates"
        :key="s"
        type="button"
        class="demo-chip"
        :aria-pressed="upload === s"
        @click="upload = s"
      >
        {{ s }}
      </button>
    </div>
    <UiMediaUploader
      :state="upload"
      file-name="hero.jpg"
      :progress="64"
      reason="This file type isn't supported."
      types="JPG, PNG or WebP"
      max-size="5 MB"
      accept="image/jpeg,image/png,image/webp"
      @remove="upload = 'choosing'"
    />
  </GalleryBlock>

  <GalleryBlock name="UiCountdown">
    <UiCountdown
      :seconds-remaining="seconds"
      :total-seconds="60"
      label="Time left for this question"
      extendable
      @extend="seconds += 30"
    />
    <div class="demo-chips">
      <button type="button" class="demo-chip" @click="seconds = Math.max(0, seconds - 10)">
        -10 s
      </button>
      <button type="button" class="demo-chip" @click="seconds = 60">Reset</button>
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiRewardCard">
    <div class="demo-grid">
      <UiRewardCard name="Weekend getaway" value="GHS 4,000" :quantity="3" rules-href="/terms" />
      <UiRewardCard
        name="Data bundle"
        value="GHS 20"
        :quantity="500"
        :remaining="212"
        rules-href="/terms"
      />
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiDrawProofPanel">
    <UiDrawProofPanel :proof="proof" />
  </GalleryBlock>
</template>

<style scoped>
.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 6), 1fr));
  gap: var(--ui-space-4);
}
.demo-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.demo-chip {
  min-block-size: var(--ui-target-dashboard);
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-primary);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-pill);
  font: inherit;
  cursor: pointer;
}
.demo-chip[aria-pressed='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-color: var(--ui-color-action-primary);
}
</style>
