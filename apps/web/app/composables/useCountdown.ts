import { computed, onBeforeUnmount, ref } from 'vue';

/**
 * Counts down whole seconds, for Retry-After (429/503): controls stay disabled until it reaches
 * zero (spec section 11). Client-side only; the timer is cleared on unmount.
 */
export function useCountdown() {
  const remaining = ref(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function start(seconds: number) {
    stop();
    remaining.value = Math.max(0, Math.ceil(seconds));
    if (remaining.value === 0) return;
    timer = setInterval(() => {
      remaining.value -= 1;
      if (remaining.value <= 0) {
        remaining.value = 0;
        stop();
      }
    }, 1000);
  }

  onBeforeUnmount(stop);

  /** m:ss, as used in the rate-limit message ("Try again in 0:45"). */
  const text = computed(
    () => `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`,
  );

  return { remaining, text, active: computed(() => remaining.value > 0), start, stop };
}
