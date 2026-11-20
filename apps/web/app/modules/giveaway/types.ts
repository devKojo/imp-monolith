/** A giveaway as the API returns it (apps/api modules/giveaway). */

/** What a visitor may know before signing in. */
export type GiveawayInfo = {
  slug: string;
  title: string;
  businessName: string;
  endsAt: string;
  /** Entries so far, one per person. */
  entryCount: number;
};

export type GiveawayView = GiveawayInfo & {
  summary: string;
  /** The participant's own entry, once made. */
  entry: { ticketNumber: number; enteredAt: string } | null;
};
