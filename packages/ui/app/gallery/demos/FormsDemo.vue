<script setup lang="ts">
import { computed, ref } from 'vue';
import UiCaptchaWrapper from '../../components/UiCaptchaWrapper.vue';
import UiCheckbox from '../../components/UiCheckbox.vue';
import UiChoiceGroup from '../../components/UiChoiceGroup.vue';
import UiConsentGroup, { type ConsentValue } from '../../components/UiConsentGroup.vue';
import UiDateTimeField, { type DateTimeValue } from '../../components/UiDateTimeField.vue';
import UiErrorSummary from '../../components/UiErrorSummary.vue';
import UiFormField from '../../components/UiFormField.vue';
import UiOtpInput from '../../components/UiOtpInput.vue';
import UiPhoneInput from '../../components/UiPhoneInput.vue';
import UiSelect from '../../components/UiSelect.vue';
import UiSwitch from '../../components/UiSwitch.vue';
import UiTextInput from '../../components/UiTextInput.vue';
import UiFilterChips from '../../components/UiFilterChips.vue';
import UiLink from '../../components/UiLink.vue';
import UiPasswordField from '../../components/UiPasswordField.vue';
import UiSearchField from '../../components/UiSearchField.vue';
import UiSegmentedControl from '../../components/UiSegmentedControl.vue';
import GalleryBlock from '../GalleryBlock.vue';

const name = ref('');
const about = ref('x'.repeat(70));
const phone = ref('0241234567');
const country = ref('GH');
const code = ref('');
type OtpStatus = 'idle' | 'verifying' | 'wrong' | 'expired' | 'limit' | 'cannotSend' | 'verified';
const otpStatus = ref<OtpStatus>('idle');
const otpStates: OtpStatus[] = [
  'idle',
  'verifying',
  'wrong',
  'expired',
  'limit',
  'cannotSend',
  'verified',
];
const resend = ref(42);
const sel = ref('accra');
const agree = ref(false);
const live = ref(true);
const choice = ref('');
const when = ref<DateTimeValue>({ date: '2026-11-30', time: '23:59', zone: 'Africa/Accra' });
const consent = ref<ConsentValue>({ accepted: false, optional: {} });
const errors = ref<Array<{ fieldId: string; message: string }>>([]);
const showErrors = () =>
  (errors.value = [
    { fieldId: 'demo-name', message: 'Enter your full name.' },
    {
      fieldId: 'demo-phone',
      message: 'Enter a phone number we can text, for example 024 123 4567.',
    },
  ]);
const nameError = computed(() => (errors.value.length ? 'Enter your full name.' : undefined));
const captchaState = ref<'challenge' | 'failed'>('challenge');

const password = ref('');
const pwRules = computed(() => [
  { id: 'len', label: 'At least 12 characters', met: password.value.length >= 12 },
  {
    id: 'name',
    label: 'Does not contain your email name',
    met: password.value.length > 0 && !password.value.toLowerCase().includes('ada'),
  },
  {
    id: 'rep',
    label: 'Not one repeated character',
    met: password.value.length > 1 && !/^(.)\1+$/.test(password.value),
  },
]);
const signinPassword = ref('');
const chip = ref('all');
const query = ref('');
const searched = ref('');

const segmented = ref('all');
</script>

<template>
  <GalleryBlock name="UiFormField">
    <UiFormField v-slot="f" label="Campaign name" hint="3 to 80 characters." required>
      <input :id="f.id" class="ui-control" :aria-describedby="f.describedBy" />
    </UiFormField>
    <UiFormField
      v-slot="f"
      label="Campaign name"
      error="Name must be at least 3 characters."
      required
    >
      <input :id="f.id" class="ui-control" aria-invalid="true" :aria-describedby="f.describedBy" />
    </UiFormField>
  </GalleryBlock>

  <GalleryBlock name="UiTextInput">
    <UiTextInput
      v-model="name"
      label="Full name"
      hint="As it appears on your ID."
      autocomplete="name"
      required
    />
    <UiTextInput
      v-model="name"
      label="Full name"
      error="Enter your full name."
      autocomplete="name"
      required
    />
    <UiTextInput
      v-model="about"
      label="Prize description"
      multiline
      :maxlength="80"
      hint="Shown on the campaign page."
    />
    <UiTextInput model-value="Read only" label="Slug" readonly />
  </GalleryBlock>

  <GalleryBlock name="UiPhoneInput">
    <UiPhoneInput v-model="phone" v-model:country="country" required />
    <p class="ui-text-body-s ui-text-hint">
      Type or paste local (024 123 4567) or international (+233 24 123 4567); it formats when you
      leave the field.
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiOtpInput">
    <div class="demo-chips">
      <button
        v-for="s in otpStates"
        :key="s"
        type="button"
        class="demo-chip"
        :aria-pressed="otpStatus === s"
        @click="otpStatus = s"
      >
        {{ s }}
      </button>
    </div>
    <div class="demo-narrow">
      <UiOtpInput
        v-model="code"
        masked-destination="024 *** ** 67"
        :status="otpStatus"
        :attempts-left="3"
        :resend-seconds="otpStatus === 'idle' ? resend : 0"
        limit-time="45 minutes"
        @verify="otpStatus = 'verifying'"
        @resend="resend = 60"
      />
    </div>
  </GalleryBlock>

  <GalleryBlock name="UiSelect">
    <UiSelect
      v-model="sel"
      label="City"
      :options="[
        { value: 'accra', label: 'Accra' },
        { value: 'kumasi', label: 'Kumasi' },
      ]"
    />
  </GalleryBlock>

  <GalleryBlock name="UiCheckbox">
    <UiCheckbox v-model="agree" label="I accept the terms" description="Required to enter." />
    <UiCheckbox
      :model-value="false"
      label="I accept the terms"
      error="Accept the terms to continue."
    />
  </GalleryBlock>

  <GalleryBlock name="UiSwitch">
    <UiSwitch v-model="live" label="Show remaining prizes" />
  </GalleryBlock>

  <GalleryBlock name="UiChoiceGroup">
    <UiChoiceGroup
      v-model="choice"
      legend="Where is the capital of Ghana?"
      :options="[
        { value: 'accra', label: 'Accra' },
        { value: 'kumasi', label: 'Kumasi', description: 'Hint shown under the option' },
        { value: 'tamale', label: 'Tamale' },
      ]"
      required
    />
    <UiChoiceGroup
      v-model="choice"
      legend="Same options as a list"
      variant="list"
      :options="[
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
      ]"
    />
  </GalleryBlock>

  <GalleryBlock name="UiDateTimeField">
    <UiDateTimeField
      v-model="when"
      legend="Campaign end"
      :zones="['Africa/Accra', 'Europe/London', 'America/New_York']"
      visitor-zone="America/New_York"
      hint="Entries started before this time may finish within the grace period."
    />
  </GalleryBlock>

  <GalleryBlock name="UiErrorSummary">
    <UiErrorSummary :errors="errors" />
    <UiTextInput id="demo-name" v-model="name" label="Full name" :error="nameError" />
    <UiPhoneInput
      id="demo-phone"
      v-model="phone"
      v-model:country="country"
      :error="errors.length ? 'Enter a phone number we can text.' : undefined"
    />
    <button type="button" class="demo-chip" @click="showErrors">Submit with errors</button>
  </GalleryBlock>

  <GalleryBlock name="UiConsentGroup">
    <UiConsentGroup
      v-model="consent"
      legend="Terms and consent"
      :terms="{ label: 'I accept the competition terms', version: '3', href: '/terms' }"
      :optional="[
        {
          id: 'email',
          label: 'Email me about future campaigns',
          description: 'We send at most one email a month.',
          version: '2',
          href: '/privacy#email',
        },
        {
          id: 'sms',
          label: 'Text me about future campaigns',
          description: 'Standard message rates apply.',
          version: '2',
          href: '/privacy#sms',
        },
      ]"
    />
  </GalleryBlock>

  <GalleryBlock name="UiCaptchaWrapper">
    <UiCaptchaWrapper :state="captchaState" @alternative="captchaState = 'challenge'">
      <button type="button" class="demo-chip" @click="captchaState = 'failed'">
        [ provider widget ] fail this check
      </button>
    </UiCaptchaWrapper>
  </GalleryBlock>

  <GalleryBlock name="UiPasswordField">
    <UiPasswordField
      v-model="password"
      label="Create password"
      autocomplete="new-password"
      :rules="pwRules"
      required
      hint="Use a phrase you can remember. We also check it against known breaches."
    />
    <UiPasswordField v-model="signinPassword" label="Password" error="Invalid email or password.">
      <template #labelAside><UiLink to="/ui/states">Forgot password?</UiLink></template>
    </UiPasswordField>
  </GalleryBlock>

  <GalleryBlock name="UiFilterChips">
    <UiFilterChips
      v-model="chip"
      label="Campaign type"
      :options="[
        { value: 'all', label: 'All campaigns' },
        { value: 'quiz', label: 'Quizzes', icon: 'clipboard-list' },
        { value: 'poll', label: 'Polls', icon: 'bar-chart' },
        { value: 'giveaway', label: 'Giveaways', icon: 'gift' },
      ]"
    />
    <p class="ui-text-body-s">Selected: {{ chip }}</p>
  </GalleryBlock>

  <GalleryBlock name="UiSearchField">
    <UiSearchField v-model="query" label="Search campaigns" @search="searched = $event" />
    <p class="ui-text-body-s" role="status">Last search: {{ searched || 'none' }}</p>
  </GalleryBlock>

  <GalleryBlock name="UiSegmentedControl">
    <UiSegmentedControl
      v-model="segmented"
      label="Campaign status"
      :options="[
        { value: 'all', label: 'All' },
        { value: 'live', label: 'Live' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'paused', label: 'Paused' },
      ]"
    />
  </GalleryBlock>
</template>

<style scoped>
.demo-narrow {
  max-inline-size: calc(var(--ui-space-12) * 8);
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
