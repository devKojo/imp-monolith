/**
 * Who may see participants. Names are personal data, so this is narrower than reading campaigns: the
 * people who run the business and its analysts. Operators and moderators are not included. The role comes
 * from the session's active membership, never from the request.
 */
const VIEW = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER', 'ANALYST']);

export const canViewParticipants = (role: string): boolean => VIEW.has(role);
