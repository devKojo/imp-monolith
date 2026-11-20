/**
 * Who may settle a campaign and see its awards. Awards name people and decide who is paid, so this is the
 * people who run the business and its campaigns; operators, analysts and moderators only read participation
 * elsewhere. The role comes from the session's active membership, never from the request.
 */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);

export const canManageRewards = (role: string): boolean => MANAGE.has(role);
