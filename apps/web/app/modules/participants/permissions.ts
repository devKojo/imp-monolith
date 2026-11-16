/**
 * Who may see participants. Mirrors the API (which still decides): the people who run the business and
 * its analysts. It only decides whether to show or hide the page and its link.
 */
const VIEW = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER', 'ANALYST']);

export const canViewParticipants = (role: string | undefined): boolean =>
  role !== undefined && VIEW.has(role);
