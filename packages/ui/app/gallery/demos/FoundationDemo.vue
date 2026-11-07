<script setup lang="ts">
import { ref } from 'vue';
import UiButton from '../../components/UiButton.vue';
import UiCard from '../../components/UiCard.vue';
import UiIcon from '../../components/UiIcon.vue';
import UiLink from '../../components/UiLink.vue';
import UiLiveRegion from '../../components/UiLiveRegion.vue';
import UiProgress from '../../components/UiProgress.vue';
import { icons, type IconName } from '../../icons';
import UiDivider from '../../components/UiDivider.vue';
import UiAvatar from '../../components/UiAvatar.vue';
import UiIconTile from '../../components/UiIconTile.vue';
import GalleryBlock from '../GalleryBlock.vue';

const names = Object.keys(icons) as IconName[];
const message = ref('');
</script>

<template>
  <GalleryBlock name="UiIcon">
    <ul class="demo-icons">
      <li v-for="n in names" :key="n">
        <UiIcon :name="n" :size="24" /> <code class="ui-text-caption">{{ n }}</code>
      </li>
    </ul>
    <p class="ui-text-body-s">
      Meaningful on its own: <UiIcon name="check-circle" label="Saved" :size="24" /> (has a label).
      Decorative icons sit beside text.
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiLink">
    <p>
      <UiLink to="/ui">Internal link</UiLink> ·
      <UiLink to="https://example.com" external>External link</UiLink>
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiLiveRegion">
    <UiButton variant="secondary" @click="message = `Saved at ${new Date().toLocaleTimeString()}`"
      >Trigger a polite announcement</UiButton
    >
    <UiLiveRegion :message="message" visible />
    <p class="ui-text-body-s ui-text-hint">
      Visible here for the demo; normally visually hidden and read by screen readers.
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiProgress">
    <UiProgress :value="25" label="Upload" />
    <UiProgress :value="60" label="Quota" tone="warning" />
    <UiProgress :value="100" label="Done" tone="success" />
    <UiProgress :value="90" label="Spend cap" tone="danger" />
    <UiProgress label="Working" />
  </GalleryBlock>

  <GalleryBlock name="UiCard">
    <UiCard title="Default card">Content goes here.</UiCard>
    <UiCard title="Subtle card" tone="subtle">Used for secondary groupings.</UiCard>
    <UiCard title="Raised card" raised>Raised cards keep their border.</UiCard>
  </GalleryBlock>

  <GalleryBlock name="UiDivider">
    <UiDivider />
    <UiDivider label="or" />
    <UiDivider label="or sign in with email" />
  </GalleryBlock>

  <GalleryBlock name="UiAvatar">
    <div class="demo-row">
      <UiAvatar name="Kwame Mensah" />
      <UiAvatar name="Kwame Mensah" verified />
      <UiAvatar name="Ama" size="sm" />
      <UiAvatar name="Alex Boateng" tone="soft" />
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiIconTile">
    <div class="demo-row">
      <UiIconTile icon="ticket" />
      <UiIconTile icon="cash" tone="success" />
      <UiIconTile icon="alert-triangle" tone="warning" />
      <UiIconTile icon="calendar" tone="neutral" />
      <UiIconTile icon="rocket" size="sm" />
      <UiIconTile icon="cpu" size="lg" />
    </div>
  </GalleryBlock>
</template>

<style scoped>
.demo-icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 3), 1fr));
  gap: var(--ui-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.demo-icons li {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
}
</style>
