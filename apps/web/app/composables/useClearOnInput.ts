import { watch, type Ref } from 'vue';

/**
 * Clears a field's error as soon as the user edits that field. A stale error next to a corrected
 * value reads as "still wrong" (and is announced again by screen readers); the form re-validates
 * on the next submit. `errors` is replaced, not mutated, so watchers and the error summary update.
 */
export function useClearOnInput<K extends string>(
  errors: Ref<Partial<Record<K, string>>>,
  sources: Record<K, Ref<unknown>>,
) {
  for (const key of Object.keys(sources) as K[]) {
    watch(sources[key], () => {
      if (!errors.value[key]) return;
      const next = { ...errors.value };
      delete next[key];
      errors.value = next;
    });
  }
}
