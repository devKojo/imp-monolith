<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
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
import {
  PRIZE_KINDS,
  amountInput as prizeAmountText,
  amountPatch,
  currencyPatch,
  placeOf,
  rewardProblem,
  withKind as prizeWithKind,
} from '../prizeRewards';
import type { PoolKind, Prize, PrizeKind, PrizePool } from '../types';

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
  /** Whether tiers may go to the first to pass (a quiz or a survey). */
  firstAllowed?: boolean;
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

// ---- how winners are chosen: for the whole campaign, so every tier gets the same choice
const chooseOptions = [
  { value: 'end', label: t('cmp.prizes.choose.end') },
  { value: 'first', label: t('cmp.prizes.choose.first') },
];
const chosen = computed(() =>
  props.prizes.length > 0 && props.prizes.every((p) => p.selection === 'COMPLETION')
    ? 'first'
    : 'end',
);
function onChoose(value: string) {
  for (const p of props.prizes) {
    emit('update', p.id, { selection: value === 'first' ? 'COMPLETION' : null });
  }
}

// ---- what a tier is worth: cash or points, and the places it covers. Typed text is kept as typed;
// a prize only takes a value that is valid.
const prizeKinds = PRIZE_KINDS.map((k) => ({
  value: k,
  label: t(`cmp.prize.kind.${k}` as AppTextKey),
}));
const amountTyped = reactive<Record<string, string>>({});
const placeTyped = reactive<Record<string, string>>({});
const amountOf = (p: Prize) => amountTyped[p.id] ?? prizeAmountText(p);
const placeOfPrize = (p: Prize, end: 'rankFrom' | 'rankTo') =>
  placeTyped[`${p.id}:${end}`] ?? (p[end] ? String(p[end]) : '');
function onPrizeKind(p: Prize, kind: string) {
  delete amountTyped[p.id];
  emit('update', p.id, prizeWithKind(kind as PrizeKind));
}
function onPrizeAmount(p: Prize, text: string) {
  amountTyped[p.id] = text;
  emit('update', p.id, amountPatch(p, text));
}
function onPrizeCurrency(p: Prize, currency: string) {
  emit('update', p.id, currencyPatch(currency, amountOf(p)));
}
function onPlace(p: Prize, end: 'rankFrom' | 'rankTo', text: string) {
  placeTyped[`${p.id}:${end}`] = text;
  emit('update', p.id, { [end]: placeOf(text) });
}
const rewardHint = (p: Prize) => {
  const problem = rewardProblem(p);
  return problem ? t(`cmp.prize.problem.${problem}` as AppTextKey) : '';
};

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

    <div v-if="!pool && firstAllowed && prizes.length > 0" class="choose">
      <UiSegmentedControl
        :model-value="chosen"
        :label="t('cmp.prizes.choose')"
        :options="chooseOptions"
        :disabled="readonly"
        @update:model-value="onChoose"
      />
      <p class="ui-text-caption ui-text-hint">
        {{ t(chosen === 'first' ? 'cmp.prizes.choose.first.hint' : 'cmp.prizes.choose.end.hint') }}
      </p>
    </div>

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
        <div class="prize__reward">
          <UiSelect
            :id="`prize-kind-${p.id}`"
            :model-value="p.kind ?? 'ITEM'"
            :label="t('cmp.prize.kind')"
            :options="prizeKinds"
            :disabled="readonly"
            @update:model-value="onPrizeKind(p, $event)"
          />
          <UiSelect
            v-if="p.kind === 'CASH'"
            :id="`prize-currency-${p.id}`"
            :model-value="p.currency ?? ''"
            :label="t('cmp.prize.currency')"
            :options="currencyOptions"
            :disabled="readonly"
            @update:model-value="onPrizeCurrency(p, $event)"
          />
          <UiTextInput
            v-if="p.kind === 'CASH' || p.kind === 'POINTS'"
            :id="`prize-amount-${p.id}`"
            type="text"
            inputmode="decimal"
            :model-value="amountOf(p)"
            :label="p.kind === 'CASH' ? t('cmp.prize.amount.cash') : t('cmp.prize.amount.points')"
            :readonly="readonly"
            @update:model-value="onPrizeAmount(p, $event)"
          />
          <UiTextInput
            :id="`prize-from-${p.id}`"
            type="number"
            inputmode="numeric"
            :model-value="placeOfPrize(p, 'rankFrom')"
            :label="t('cmp.prize.rankFrom')"
            :readonly="readonly"
            @update:model-value="onPlace(p, 'rankFrom', $event)"
          />
          <UiTextInput
            :id="`prize-to-${p.id}`"
            type="number"
            inputmode="numeric"
            :model-value="placeOfPrize(p, 'rankTo')"
            :label="t('cmp.prize.rankTo')"
            :readonly="readonly"
            @update:model-value="onPlace(p, 'rankTo', $event)"
          />
        </div>
        <p class="ui-text-caption ui-text-hint">
          {{ rewardHint(p) || t('cmp.prize.place.hint') }}
        </p>
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
.choose {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
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
.prize__reward {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--ui-space-3);
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
