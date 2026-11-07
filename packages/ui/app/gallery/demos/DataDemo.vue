<script setup lang="ts">
import { computed, ref } from 'vue';
import UiChart from '../../components/UiChart.vue';
import UiDataTable, { type SortState } from '../../components/UiDataTable.vue';
import UiMaskedValue from '../../components/UiMaskedValue.vue';
import UiStatusChip from '../../components/UiStatusChip.vue';
import { maskEmail, maskPhone } from '../../utils/phone';
import UiStatCard from '../../components/UiStatCard.vue';
import GalleryBlock from '../GalleryBlock.vue';

const all = [
  { id: '1', name: 'Black Friday Quiz', status: 'LIVE', dates: '20 Nov - 30 Nov', entries: 12480 },
  { id: '2', name: 'Weekend Giveaway', status: 'PAUSED', dates: '01 Dec - 15 Dec', entries: 3102 },
  { id: '3', name: 'Brand Poll', status: 'DRAFT', dates: '-', entries: 0 },
  {
    id: '4',
    name: 'Holiday Draw',
    status: 'PAUSED_BY_PLATFORM',
    dates: '10 Dec - 24 Dec',
    entries: 780,
  },
];
const shown = ref(2);
const sort = ref<SortState>({ key: 'name', direction: 'asc' });
const rows = computed(() => {
  const list = [...all].sort(
    (a, b) =>
      String(a[sort.value?.key as 'name']).localeCompare(String(b[sort.value?.key as 'name'])) *
      (sort.value?.direction === 'desc' ? -1 : 1),
  );
  return list.slice(0, shown.value);
});
const loading = ref(false);
function more() {
  loading.value = true;
  setTimeout(() => ((shown.value = all.length), (loading.value = false)), 600);
}
const reveal = () => Promise.resolve('024 123 4567');

const line = [
  {
    name: 'Entries',
    points: [
      { label: 'Mon', value: 120 },
      { label: 'Tue', value: 340 },
      { label: 'Wed', value: 280 },
      { label: 'Thu', value: 510 },
    ],
  },
  {
    name: 'Verified',
    points: [
      { label: 'Mon', value: 90 },
      { label: 'Tue', value: 210 },
      { label: 'Wed', value: 260 },
      { label: 'Thu', value: 330 },
    ],
  },
];
const funnel = [
  {
    name: 'Funnel',
    points: [
      { label: 'Viewed', value: 20000 },
      { label: 'Started', value: 9000 },
      { label: 'Verified', value: 6500 },
      { label: 'Confirmed', value: 5200 },
    ],
  },
];
</script>

<template>
  <GalleryBlock name="UiDataTable">
    <UiDataTable
      v-model:sort="sort"
      name="Campaigns"
      row-key="id"
      :rows="rows"
      :total="all.length"
      :has-more="shown < all.length"
      :loading="loading"
      :columns="[
        { key: 'name', label: 'Name', sortable: true },
        { key: 'status', label: 'Status' },
        { key: 'dates', label: 'Dates (GMT)', priority: 'medium' },
        { key: 'entries', label: 'Entries', priority: 'low' },
      ]"
      @load-more="more"
    >
      <template #cell-status="{ value }"
        ><UiStatusChip vocabulary="campaign" :status="String(value)"
      /></template>
      <template #cell-entries="{ value }">{{ Number(value).toLocaleString() }}</template>
    </UiDataTable>
    <UiDataTable
      name="Empty example"
      row-key="id"
      :rows="[]"
      :columns="[{ key: 'name', label: 'Name' }]"
    />
    <UiDataTable
      name="Loading example"
      row-key="id"
      :rows="[]"
      loading
      :columns="[{ key: 'name', label: 'Name' }]"
    />
  </GalleryBlock>

  <GalleryBlock name="UiMaskedValue">
    <p>
      Allowed to reveal:
      <UiMaskedValue
        :masked="maskPhone('0241234567')"
        what="phone number"
        :reveal="reveal"
        :auto-mask-ms="5000"
      />
    </p>
    <p>
      Not allowed (no reveal control):
      <UiMaskedValue :masked="maskEmail('kofi@mail.com')" what="email" />
    </p>
    <p class="ui-text-body-s ui-text-hint">Demo re-masks after 5 s; production uses 30 s.</p>
  </GalleryBlock>

  <GalleryBlock name="UiChart">
    <UiChart
      type="line"
      title="Entries per day"
      :series="line"
      summary="Entries rose from 120 on Monday to 510 on Thursday; verified entries followed at about 65%."
      status="provisional"
    />
    <UiChart
      type="bar"
      title="Entries per day (bars)"
      :series="line"
      summary="Thursday was the busiest day with 510 entries."
    />
    <UiChart
      type="funnel"
      title="Participation funnel"
      :series="funnel"
      summary="45% of visitors started and 26% confirmed an entry."
      approx
    />
  </GalleryBlock>

  <GalleryBlock name="UiStatCard">
    <div class="demo-stats">
      <UiStatCard
        label="Active entries"
        label-style="eyebrow"
        value="4"
        suffix="tickets live"
        icon="ticket"
      />
      <UiStatCard
        label="Active participants"
        value="148,290"
        badge="Up 12.4%"
        badge-icon="arrow-up"
        icon="users"
        :footer="[{ label: 'Compared with last period', value: '+16,340 new' }]"
      />
      <UiStatCard
        label="Draw health"
        value="100%"
        badge="Verified"
        badge-tone="info"
        icon="shield-check"
        :footer="[{ label: 'Cryptographic integrity', value: '0 anomalies' }]"
      />
    </div>
  </GalleryBlock>
</template>

<style scoped>
.demo-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-4);
}
</style>
