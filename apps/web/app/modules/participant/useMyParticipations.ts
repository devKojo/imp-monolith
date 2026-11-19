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

/**
 * What the signed-in person has taken part in, from the API (newest first). The hub is
 * client-rendered, so this loads in the browser only; a failed load is reported, never hidden.
 */
export function useMyParticipations() {
  const { data, pending, error, refresh } = useAsyncData<MyParticipation[]>(
    'participant:participations',
    async () => {
      const res = await $fetch<{ items: MyParticipation[] }>('/api/v1/me/participations');
      return res.items;
    },
    { server: false, default: () => [] },
  );
  return { items: data, pending, error, refresh };
}
