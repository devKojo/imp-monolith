<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiFormField from './UiFormField.vue';
import UiLiveRegion from './UiLiveRegion.vue';

/**
 * OTP screen body (spec 6.3, UI-PUB-12). One field, 6 digits, one-time-code autofill, paste
 * supported, auto-submit on the 6th digit with the Verify button always available, resend
 * countdown, "Change number". The parent owns the state machine and the timer.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    maskedDestination: string;
    status?: 'idle' | 'verifying' | 'wrong' | 'expired' | 'limit' | 'cannotSend' | 'verified';
    attemptsLeft?: number;
    /** Seconds until resend is allowed (0 = allowed now). */
    resendSeconds?: number;
    /** Human time for the resend-limit message, e.g. "45 minutes". */
    limitTime?: string;
  }>(),
  { status: 'idle', attemptsLeft: 0, resendSeconds: 0, limitTime: '' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  verify: [code: string];
  resend: [];
  changeNumber: [];
}>();

const input = ref<HTMLInputElement | null>(null);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const error = computed(() => {
  switch (props.status) {
    case 'wrong':
      return uiText('otp.wrong', { n: props.attemptsLeft });
    case 'expired':
      return uiText('otp.expired');
    case 'limit':
      return uiText('otp.limit', { time: props.limitTime });
    case 'cannotSend':
      return uiText('otp.cannotSend');
    default:
      return undefined;
  }
});

// Assistive tech hears the countdown every 10 s; sighted users see it every second (spec 6.3).
const countdownVisual = computed(() => uiText('otp.resendIn', { time: mmss(props.resendSeconds) }));
const announced = ref('');
watch(
  () => props.resendSeconds,
  (s) => {
    if (s > 0 && s % 10 === 0) announced.value = uiText('otp.resendIn', { time: mmss(s) });
  },
);
const statusMessage = computed(() =>
  props.status === 'verified' ? uiText('otp.verified') : (error.value ?? announced.value),
);

function onInput(e: Event) {
  const digits = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
  (e.target as HTMLInputElement).value = digits; // digits only, paste and autofill included
  emit('update:modelValue', digits);
  if (digits.length === 6) emit('verify', digits); // auto-submit; the button remains available
}

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div class="ui-otp">
    <p class="ui-otp__sent ui-text-body-l">
      {{ uiText('otp.sent', { masked: maskedDestination }) }}
    </p>
    <UiFormField
      v-slot="field"
      :label="uiText('otp.label')"
      :hint="uiText('otp.hint')"
      :error="error"
      required
    >
      <input
        :id="field.id"
        ref="input"
        class="ui-control ui-otp__field"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        maxlength="6"
        :value="modelValue"
        :readonly="status === 'verifying'"
        :aria-invalid="field.invalid ? 'true' : undefined"
        :aria-describedby="field.describedBy"
        @input="onInput"
      />
    </UiFormField>
    <UiButton
      block
      :loading="status === 'verifying'"
      :loading-label="uiText('otp.verifying')"
      :disabled="modelValue.length < 6 && status !== 'verifying'"
      :disabled-reason="modelValue.length < 6 ? uiText('otp.enterAll') : undefined"
      @click="emit('verify', modelValue)"
    >
      {{ uiText('otp.verify') }}
    </UiButton>
    <div class="ui-otp__actions">
      <UiButton
        variant="tertiary"
        :disabled="resendSeconds > 0 || status === 'limit' || status === 'cannotSend'"
        @click="emit('resend')"
      >
        {{ uiText('otp.resend') }}
      </UiButton>
      <span v-if="resendSeconds > 0" class="ui-text-body-s ui-text-hint" aria-hidden="true">{{
        countdownVisual
      }}</span>
      <UiButton variant="tertiary" @click="emit('changeNumber')">{{
        uiText('otp.changeNumber')
      }}</UiButton>
    </div>
    <UiLiveRegion :message="statusMessage" />
  </div>
</template>

<style scoped>
.ui-otp {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.ui-otp__sent {
  margin: 0;
}
.ui-otp__field {
  font-size: var(--ui-font-h2-size);
  letter-spacing: var(--ui-space-2);
  text-align: center;
}
.ui-otp__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
</style>
