/**
 * Giveaways: a participant enters a running giveaway once and gets a ticket. The prizes and the schedule
 * are written on the campaign by the business (`campaigns`); this module only records who entered.
 */

/** A running giveaway campaign found by its public address. */
export type RunnableGiveaway = {
  campaignId: string;
  tenantId: string;
  title: string;
  summary: string;
  businessName: string;
  endAt: Date;
};

/** An entry as stored. The ticket number is 1, 2, 3... in the order people entered. */
export type EntryRow = { ticketNumber: number; enteredAt: Date };

/** What a visitor may know before signing in. */
export type GiveawayInfo = {
  slug: string;
  title: string;
  businessName: string;
  endsAt: string;
  /** Entries so far, one per person. */
  entryCount: number;
};

/** What the participant app renders. */
export type GiveawayView = GiveawayInfo & {
  summary: string;
  /** The participant's own entry, once made. */
  entry: { ticketNumber: number; enteredAt: string } | null;
};

/** The signed-in participant. */
export type Participant = { userId: string; accountType: string };
