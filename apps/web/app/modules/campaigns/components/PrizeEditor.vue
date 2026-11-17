<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { t, type AppTextKey } from '../../../i18n';
import { LIMITS } from '../logic';
import {
  POOL_CURRENCIES,
  POOL_LIMITS,
  amountText,
  formatAmount,
  newPool,
  parseAmount,
  poolProblem,
  poolShare,
  withKind,
} from '../pool';
import type { PoolKind, Prize, PrizePool } from '../types';

/**
 * The prize tiers of a campaign, in the order the page shows them. Reordering uses buttons rather than
 * drag and drop, so it works with a keyboard and a screen reader (UI-A11Y-08). Changes are sent up;
 * the page owns the data.
 *
 * A campaign gives its prize either as tiers with winners, or as a pool: one amount (points or money)
 * shared equally by a limited number of participants. The switch at the top chooses which; the pool
 * shows each participant's share as it is typed.
 */
const props = defineProps<{
  prizes: Prize[];
  pool: PrizePool | null;
  /** Places taken so far, once the campaign is running; shown beside the pool. */
  joined?: number | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  'update:pool': [pool: PrizePool | null];
  add: [];
  update: [id: string, patch: Partial<Omit<Prize, 'id'>>];
  move: [id: string, direction: -1 | 1];
  remove: [id: string];
}>();

/**
 * Winners is a whole number from 1. What is typed is kept as typed, so a field can be cleared and
 * retyped; the prize only takes a value that is valid, and the field settles on it when it loses focus.
 */
const typed = reactive<Record<string, string>>({});
function onWinners(id: string, text: string) {
  typed[id] = text;
  const n = Number(text);
  if (text.trim() === '' || !Number.isFinite(n) || n < 1) return;
  if (n > LIMITS.winners) typed[id] = String(LIMITS.winners);
  emit('update', id, { winners: Math.min(LIMITS.winners, Math.floor(n)) });
}
const settle = (id: string) => delete typed[id];

// ---- the prize pool: what is typed is kept as typed; the pool only takes values that are valid
const modeOptions = [
  { value: 'tiers', label: t('cmp.prizeMode.tiers') },
  { value: 'pool', label: t('cmp.prizeMode.pool') },
];
const kindOptions = [
  { value: 'POINTS', label: t('cmp.pool.points') },
  { value: 'MONEY', label: t('cmp.pool.money') },
];
const currencyOptions = POOL_CURRENCIES.map((c) => ({ value: c, label: c }));
const amountInput = ref(props.pool ? amountText(props.pool) : '');
const maxInput = ref(
  props.pool && props.pool.maxParticipants > 0 ? String(props.pool.maxParticipants) : '',
);
// Starting a new pool, or coming back to the editor, begins from what the pool holds.
watch(
  () => props.pool === null,
  (none) => {
    if (none) return;
    amountInput.value = props.pool ? amountText(props.pool) : '';
    maxInput.value =
      props.pool && props.pool.maxParticipants > 0 ? String(props.pool.maxParticipants) : '';
  },
);

const setMode = (mode: string) =>
  emit('update:pool', mode === 'pool' ? (props.pool ?? newPool()) : null);
/** Changing the unit or currency changes what the typed amount means, so it is read again. */
function setPool(next: PrizePool) {
  const parsed = parseAmount(amountInput.value, next);
  emit('update:pool', { ...next, amount: parsed ?? 0 });
}
const onKind = (kind: string) => props.pool && setPool(withKind(props.pool, kind as PoolKind));
const onCurrency = (currency: string) => props.pool && setPool({ ...props.pool, currency });
function onAmount(text: string) {
  amountInput.value = text;
  if (props.pool) setPool(props.pool);
}
function onMax(text: string) {
  maxInput.value = text;
  const n = Number(text);
  const valid =
    text.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= POOL_LIMITS.participantsMax;
  if (props.pool) emit('update:pool', { ...props.pool, maxParticipants: valid ? n : 0 });
}
const share = (pool: PrizePool) => poolShare(pool);
const poolHint = (pool: PrizePool) => {
  const problem = poolProblem(pool);
  return problem ? t(`cmp.pool.problem.${problem}` as AppTextKey) : '';
};
</script>

<template>
  <UiCard as="section" aria-labelledby="prizes-title" class="prizes">
    <div class="prizes__head">
      <h2 id="prizes-title" class="ui-text-h3">
        {{ t('cmp.prizes') }}
        <span v-if="!pool" class="ui-text-hint ui-text-body-s">({{ prizes.length }})</span>
      </h2>
      <UiButton
        v-if="!readonly && !pool"
        variant="secondary"
        size="xs"
        icon="plus"
        :disabled="prizes.length >= LIMITS.prizes"
        @click="emit('add')"
      >
        {{ t('cmp.prize.add') }}
      </UiButton>
    </div>

    <UiSegmentedControl
      v-if="!readonly"
      :model-value="pool ? 'pool' : 'tiers'"
      :label="t('cmp.prizeMode')"
      :options="modeOptions"
      @update:model-value="setMode"
    />

    <div v-if="pool" class="pool">
      <p v-if="joined !== null && joined !== undefined" class="ui-text-label">
        {{ t('cmp.pool.joined', { joined, max: pool.maxParticipants }) }}
      </p>
      <p class="ui-text-caption ui-text-hint">{{ t('cmp.pool.hint') }}</p>
      <div class="pool__fields">
        <UiSelect
          id="pool-kind"
          :model-value="pool.kind"
          :label="t('cmp.pool.kind')"
          :options="kindOptions"
          :disabled="readonly"
          @update:model-value="onKind"
        />
        <UiSelect
          v-if="pool.kind === 'MONEY'"
          id="pool-currency"
          :model-value="pool.currency ?? ''"
          :label="t('cmp.pool.currency')"
          :options="currencyOptions"
          :disabled="readonly"
          @update:model-value="onCurrency"
        />
        <UiTextInput
          id="pool-amount"
          type="text"
          inputmode="decimal"
          :model-value="amountInput"
          :label="pool.kind === 'MONEY' ? t('cmp.pool.amount.money') : t('cmp.pool.amount.points')"
          :readonly="readonly"
          @update:model-value="onAmount"
        />
        <UiTextInput
          id="pool-max"
          type="number"
          inputmode="numeric"
          :model-value="maxInput"
          :label="t('cmp.pool.max')"
          :hint="t('cmp.pool.max.hint')"
          :readonly="readonly"
          @update:model-value="onMax"
        />
      </div>
      <p v-if="poolHint(pool)" class="ui-text-caption ui-text-hint">
        {{ amountInput || maxInput ? poolHint(pool) : t('cmp.pool.share.empty') }}
      </p>
      <div v-else class="pool__share">
        <p class="ui-text-label">
          {{ t('cmp.pool.share', { share: formatAmount(pool, share(pool).share) }) }}
        </p>
        <p v-if="share(pool).remainder > 0" class="ui-text-caption ui-text-hint">
          {{ t('cmp.pool.remainder', { amount: formatAmount(pool, share(pool).remainder) }) }}
        </p>
      </div>
    </div>

    <p v-else-if="prizes.length === 0" class="ui-text-caption ui-text-hint">
      {{ t('cmp.prizes.empty') }}
    </p>

    <ol v-else class="prizes__list">
      <li v-for="(p, i) in prizes" :key="p.id" class="prize">
        <div class="prize__head">
          <strong class="ui-text-label">{{ t('cmp.prize.item', { n: i + 1 }) }}</strong>
          <div v-if="!readonly" class="prize__actions">
            <UiButton
              variant="tertiary"
              size="xs"
              icon="arrow-up"
              :disabled="i === 0"
              @click="emit('move', p.id, -1)"
            >
              <span class="ui-sr-only">{{
                t('cmp.prize.up', { item: p.name || String(i + 1) })
              }}</span>
            </UiButton>
            <UiButton
              variant="tertiary"
              size="xs"
              icon="arrow-down"
              :disabled="i === prizes.length - 1"
              @click="emit('move', p.id, 1)"
            >
              <span class="ui-sr-only">{{
                t('cmp.prize.down', { item: p.name || String(i + 1) })
              }}</span>
            </UiButton>
            <UiButton variant="tertiary" size="xs" icon="trash" @click="emit('remove', p.id)">
              <span class="ui-sr-only">{{
                t('cmp.prize.remove', { item: p.name || String(i + 1) })
              }}</span>
            </UiButton>
          </div>
        </div>
        <div class="prize__fields">
          <UiTextInput
            :id="`prize-name-${p.id}`"
            :model-value="p.name"
            :label="t('cmp.prize.name')"
            :maxlength="LIMITS.prizeName"
            :readonly="readonly"
            @update:model-value="emit('update', p.id, { name: $event })"
          />
          <UiTextInput
            :id="`prize-value-${p.id}`"
            :model-value="p.valueLabel"
            :label="t('cmp.prize.value')"
            :maxlength="LIMITS.prizeValue"
            :readonly="readonly"
            @update:model-value="emit('update', p.id, { valueLabel: $event })"
          />
          <UiTextInput
            :id="`prize-winners-${p.id}`"
            type="number"
            inputmode="numeric"
            :model-value="typed[p.id] ?? String(p.winners)"
            :label="t('cmp.prize.winners')"
            :readonly="readonly"
            @update:model-value="onWinners(p.id, $event)"
            @focusout="settle(p.id)"
          />
        </div>
        <UiTextInput
          :id="`prize-description-${p.id}`"
          :model-value="p.description"
          :label="t('cmp.prize.description')"
          :maxlength="LIMITS.prizeDescription"
          :readonly="readonly"
          @update:model-value="emit('update', p.id, { description: $event })"
        />
      </li>
    </ol>
  </UiCard>
</template>

<style scoped>
.prizes {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.prizes h2,
.prizes p {
  margin: 0;
}
.prizes__head,
.prize__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.pool {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.pool__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--ui-space-3);
}
.pool__share {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-color-surface-subtle);
  border-radius: var(--ui-radius-md);
}
.prizes__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.prize {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.prize__actions {
  display: flex;
  gap: var(--ui-space-1);
}
.prize__fields {
  display: grid;
  gap: var(--ui-space-3);
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 640px) {
  .prize__fields {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
