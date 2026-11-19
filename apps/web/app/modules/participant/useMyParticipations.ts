export type MyParticipation = {
  campaignId: string;
  title: string;
  slug: string | null;
  kind: 'quiz' | 'survey';
  status: 'in_progress' | 'completed';
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  total: number | null;
  passed: boolean | null;
};

/** Rows per page on the participant hub. */
export const PARTICIPATION_PAGE_SIZE = 5;

/**
 * What the signed-in person has taken part in, from the API (newest first), one page at a time.
 * The hub is client-rendered, so this loads in the browser only; a failed load is reported, never
 * hidden. `data` stays on the previous page while the next one loads, so the list does not flash.
 */
export function useMyParticipations() {
  const page = ref(1);
  const { data, pending, error, refresh } = useAsyncData<{
    items: MyParticipation[];
    total: number;
  }>(
    'participant:participations',
    () =>
      $fetch<{ items: MyParticipation[]; total: number }>('/api/v1/me/participations', {
        query: {
          limit: PARTICIPATION_PAGE_SIZE,
          offset: (page.value - 1) * PARTICIPATION_PAGE_SIZE,
        },
      }),
    { server: false, default: () => ({ items: [], total: 0 }), watch: [page] },
  );
  return { page, data, pending, error, refresh };
}
