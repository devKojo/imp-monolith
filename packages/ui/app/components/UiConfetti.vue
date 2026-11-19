<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * A one-time burst of confetti for a moment worth celebrating. Pure CSS pieces in the design
 * tokens' colours: no library, no canvas. It fires on the client only (nothing is rendered on the
 * server), ignores the pointer, is hidden from assistive technology, and does nothing at all when
 * the person prefers reduced motion. Set `active` to fire it; `done` is emitted when it has ended.
 */
const props = withDefaults(defineProps<{ active?: boolean; count?: number }>(), {
  active: true,
  count: 36,
});
const emit = defineEmits<{ done: [] }>();

const COLOURS = [
  'var(--ui-color-action-primary)',
  'var(--ui-color-success-text)',
  'var(--ui-color-warning-text)',
  'var(--ui-color-info-text)',
  'var(--ui-color-danger-action)',
];
const DURATION_MS = 2200;

type Piece = { style: Record<string, string> };
const pieces = ref<Piece[]>([]);
let timer: ReturnType<typeof setTimeout> | undefined;

/** A small repeatable generator, so the same burst looks the same and needs no Math.random. */
function sequence(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function fire() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return void emit('done');
  const next = sequence(props.count * 7919);
  pieces.value = Array.from({ length: props.count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / props.count + next() * 0.6;
    const distance = 160 + next() * 220;
    return {
      style: {
        '--dx': `${Math.round(Math.cos(angle) * distance)}px`,
        '--dy': `${Math.round(Math.sin(angle) * distance - 120)}px`,
        '--rot': `${Math.round(next() * 720 - 360)}deg`,
        '--delay': `${Math.round(next() * 120)}ms`,
        '--colour': COLOURS[i % COLOURS.length]!,
      },
    };
  });
  clearTimeout(timer);
  timer = setTimeout(() => {
    pieces.value = [];
    emit('done');
  }, DURATION_MS);
}

onMounted(() => props.active && fire());
watch(
  () => props.active,
  (on) => on && fire(),
);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div v-if="pieces.length > 0" class="ui-confetti" aria-hidden="true" data-testid="confetti">
    <span v-for="(piece, i) in pieces" :key="i" class="ui-confetti__piece" :style="piece.style" />
  </div>
</template>

<style scoped>
.ui-confetti {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow: hidden;
  pointer-events: none;
}
.ui-confetti__piece {
  position: absolute;
  inset-block-start: 40%;
  inset-inline-start: 50%;
  inline-size: 0.5rem;
  block-size: 0.9rem;
  border-radius: 1px;
  background: var(--colour);
  opacity: 0;
  animation: ui-confetti-burst 2s cubic-bezier(0.15, 0.7, 0.3, 1) var(--delay) forwards;
}
@keyframes ui-confetti-burst {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--dx), calc(var(--dy) + 220px)) rotate(var(--rot));
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-confetti {
    display: none;
  }
}
</style>
