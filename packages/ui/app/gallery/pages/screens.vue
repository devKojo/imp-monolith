<script setup lang="ts">
import { ref } from 'vue';
import UiAccordion from '../../components/UiAccordion.vue';
import UiBanner from '../../components/UiBanner.vue';
import UiBreadcrumbs from '../../components/UiBreadcrumbs.vue';
import UiButton from '../../components/UiButton.vue';
import UiCard from '../../components/UiCard.vue';
import UiChoiceGroup from '../../components/UiChoiceGroup.vue';
import UiDashboardShell from '../../components/UiDashboardShell.vue';
import UiDataTable from '../../components/UiDataTable.vue';
import UiDrawProofPanel from '../../components/UiDrawProofPanel.vue';
import UiMaskedValue from '../../components/UiMaskedValue.vue';
import UiOtpInput from '../../components/UiOtpInput.vue';
import UiPublicShell from '../../components/UiPublicShell.vue';
import UiReorderableList from '../../components/UiReorderableList.vue';
import UiStatusChip from '../../components/UiStatusChip.vue';
import UiStepper, { type Step } from '../../components/UiStepper.vue';
import UiTextInput from '../../components/UiTextInput.vue';
import type { NavItem } from '../../components/UiSidebarNav.vue';
import { maskEmail, maskPhone } from '../../utils/phone';
import GalleryFrame from '../GalleryFrame.vue';

useHead({ title: 'Screens - UI workbench' });

const nav: NavItem[] = [
  { label: 'Overview', to: '#', icon: 'globe' },
  { label: 'Campaigns', to: '#', icon: 'box', current: true },
  { label: 'Participants', to: '#', icon: 'user' },
  { label: 'Reports', to: '#', icon: 'download' },
];
const code = ref('');
const choice = ref('');
const q = ref('Which city is the capital of Ghana?');
const options = ref([
  { id: 'o1', label: 'Accra' },
  { id: 'o2', label: 'Kumasi' },
]);
function moveOption({ from, to }: { from: number; to: number }) {
  const list = [...options.value];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item!);
  options.value = list;
}
const removeOption = (id: string) => (options.value = options.value.filter((o) => o.id !== id));
const stages: Step[] = [
  { id: '1', label: 'Details', status: 'complete' },
  { id: '2', label: 'Dates', status: 'complete' },
  { id: '3', label: 'Experience', status: 'complete' },
  { id: '4', label: 'Configuration', status: 'inProgress' },
  { id: '5', label: 'Rewards', status: 'issues' },
  { id: '6', label: 'Landing page', status: 'issues' },
  { id: '7', label: 'Preview' },
  { id: '8', label: 'Publish' },
];
const proof = {
  algorithm: 'draw-v1 (HMAC-SHA-256 counter mode, rejection sampling)',
  eligibleCount: 12480,
  snapshotHash: '9f2c4e1a8b7d6c5e3f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e',
  seedCommitment: '44be0a1c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e03de',
  revealedSeed: '7a91c2f0e1d3b5a79c8e6f4d2b0a1c3e5f7a9b1d3c5e7f9a1b3d5c7e9f1a3b5c',
  verifySteps: ['Download the snapshot.', 'Check its hash.', 'Follow the verification steps.'],
};
const campaigns = [
  {
    id: '1',
    name: 'Black Friday Quiz',
    status: 'LIVE',
    dates: '20 Nov - 30 Nov',
    entries: '12,480',
  },
  {
    id: '2',
    name: 'Weekend Giveaway',
    status: 'PAUSED',
    dates: '01 Dec - 15 Dec',
    entries: '3,102',
  },
  { id: '3', name: 'Brand Poll', status: 'DRAFT', dates: '-', entries: '-' },
];
const people = [
  { id: 'a', name: 'Kofi A.', phone: '0241234567', email: 'kofi@mail.com', risk: 'LOW_RISK' },
  { id: 'b', name: 'Ama B.', phone: '0551234512', email: 'ama@mail.com', risk: 'REVIEW_REQUIRED' },
];
const reveal = () => Promise.resolve('024 123 4567');
</script>

<template>
  <GalleryFrame title="Screens" current="/ui/screens">
    <p class="ui-text-body">
      The wireframes from UI spec section 15, built only from library components. If a screen needs
      a part that is not here, that is a missing component: add it to the library first.
    </p>

    <section id="public" aria-labelledby="h-public">
      <h2 id="h-public" class="ui-text-h2">
        15.1 Public campaign page and OTP verification (360 px)
      </h2>
      <div class="pair">
        <div class="phone">
          <UiPublicShell
            brand-name="Acme Ltd"
            locale="en"
            :locales="[
              { value: 'en', label: 'English' },
              { value: 'tw', label: 'Twi' },
            ]"
          >
            <h3 class="ui-text-display">Win a weekend for two</h3>
            <p class="ui-text-body-l">
              Ends 30 Nov, 23:59 GMT <span class="ui-text-hint">(Your time: 23:59)</span>
            </p>
            <p>Prize: Weekend getaway</p>
            <UiButton size="lg" block>Enter now</UiButton>
            <UiAccordion :items="[{ id: 'how', title: 'How it works' }]"
              ><template #item-how
                >Answer 5 questions and verify your number.</template
              ></UiAccordion
            >
          </UiPublicShell>
        </div>
        <div class="phone">
          <UiPublicShell brand-name="Acme Ltd">
            <UiStepper
              :steps="[
                { id: 'a', label: 'Details' },
                { id: 'b', label: 'Verify' },
                { id: 'c', label: 'Enter' },
              ]"
              current="b"
            />
            <h3 class="ui-text-h2">Verify your number</h3>
            <UiOtpInput v-model="code" masked-destination="024 *** ** 67" :resend-seconds="42" />
          </UiPublicShell>
        </div>
      </div>
    </section>

    <section id="quiz" aria-labelledby="h-quiz">
      <h2 id="h-quiz" class="ui-text-h2">Quiz question (radio cards)</h2>
      <div class="phone">
        <UiPublicShell brand-name="Acme Ltd">
          <UiStepper
            :steps="[
              { id: '1', label: 'Q1' },
              { id: '2', label: 'Q2' },
              { id: '3', label: 'Q3' },
            ]"
            current="2"
          />
          <UiChoiceGroup
            v-model="choice"
            legend="Which city is the capital of Ghana?"
            :options="[
              { value: 'a', label: 'Accra' },
              { value: 'k', label: 'Kumasi' },
              { value: 't', label: 'Tamale' },
            ]"
          />
          <UiButton block>Next question</UiButton>
        </UiPublicShell>
      </div>
    </section>

    <section id="campaigns" aria-labelledby="h-campaigns">
      <h2 id="h-campaigns" class="ui-text-h2">15.2 Business dashboard: campaign list</h2>
      <div class="frame">
        <UiDashboardShell
          business-name="Acme Ltd"
          role-label="Owner"
          user-name="A. Mensah"
          :nav="nav"
          :unread="3"
        >
          <template #breadcrumbs><UiBreadcrumbs :items="[{ label: 'Campaigns' }]" /></template>
          <h3 class="ui-text-h1">Campaigns</h3>
          <UiDataTable
            name="Campaigns"
            row-key="id"
            :rows="campaigns"
            :total="41"
            has-more
            :columns="[
              { key: 'name', label: 'Name', sortable: true },
              { key: 'status', label: 'Status' },
              { key: 'dates', label: 'Dates (GMT)', priority: 'medium' },
              { key: 'entries', label: 'Entries', priority: 'low' },
            ]"
          >
            <template #cell-status="{ value }"
              ><UiStatusChip vocabulary="campaign" :status="String(value)"
            /></template>
          </UiDataTable>
        </UiDashboardShell>
      </div>
    </section>

    <section id="builder" aria-labelledby="h-builder">
      <h2 id="h-builder" class="ui-text-h2">15.3 Campaign builder: experience configuration</h2>
      <div class="frame builder">
        <aside><UiStepper :steps="stages" current="4" mode="builder" /></aside>
        <UiCard title="Stage 4 of 8: Experience configuration" :heading-level="3">
          <UiTextInput v-model="q" label="Question text" required />
          <UiReorderableList
            :items="options"
            label="Answer options"
            removable
            @move="moveOption"
            @remove="removeOption"
          />
          <UiBanner tone="warning" title="2 issues"
            >Add a prize description (stage 5). Add alt text to the hero image (stage 6).</UiBanner
          >
          <div class="row">
            <UiButton variant="secondary">Back</UiButton><UiButton>Save and continue</UiButton>
          </div>
        </UiCard>
      </div>
    </section>

    <section id="draw" aria-labelledby="h-draw">
      <h2 id="h-draw" class="ui-text-h2">15.4 Draw result and proof panel</h2>
      <UiCard title="Draw result - Grand prize, round 1" :heading-level="3">
        <p>
          <UiStatusChip vocabulary="rewardUnit" status="FULFILLED" /> Winners (3): #P-8F2A, #P-19C0,
          #P-77D1
        </p>
        <UiButton variant="secondary">Notify winners</UiButton>
      </UiCard>
      <UiDrawProofPanel :proof="proof" />
    </section>

    <section id="support" aria-labelledby="h-support">
      <h2 id="h-support" class="ui-text-h2">
        15.6 Elevated support view with masked participant data
      </h2>
      <UiBanner tone="elevation" title="Elevated access: Acme Ltd | Read-only | 03:12 remaining"
        ><template #actions
          ><UiButton variant="secondary">End elevation</UiButton></template
        ></UiBanner
      >
      <UiDataTable
        name="Participants"
        row-key="id"
        :rows="people"
        :columns="[
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email', priority: 'medium' },
          { key: 'risk', label: 'Risk' },
        ]"
      >
        <template #cell-phone="{ value }"
          ><UiMaskedValue :masked="maskPhone(String(value))" what="phone number" :reveal="reveal"
        /></template>
        <template #cell-email="{ value }"
          ><UiMaskedValue :masked="maskEmail(String(value))" what="email"
        /></template>
        <template #cell-risk="{ value }"
          ><UiStatusChip vocabulary="risk" :status="String(value)"
        /></template>
      </UiDataTable>
    </section>
  </GalleryFrame>
</template>

<style scoped>
section {
  margin-block: var(--ui-space-8);
}
.pair {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-6);
}
.phone {
  inline-size: calc(var(--ui-space-12) * 7.5);
  max-inline-size: 100%;
  overflow: hidden;
  border: var(--ui-focus-width) solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-lg);
}
.frame {
  overflow: hidden;
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-md);
}
.builder {
  display: grid;
  gap: var(--ui-space-4);
  padding: var(--ui-space-4);
}
.builder :deep(.ui-card) {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.row {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
@media (min-width: 1024px) {
  .builder {
    grid-template-columns: calc(var(--ui-space-12) * 6) 1fr;
  }
}
</style>
