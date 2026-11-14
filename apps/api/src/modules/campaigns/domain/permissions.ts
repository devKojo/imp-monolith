/**
 * Who can do what with campaigns. Everyone in the business can read. People who run campaigns can
 * create, edit, launch, cancel, duplicate and delete. Operators can also pause and resume a running
 * campaign. The role comes from the session's active membership, never from the request.
 */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);
const OPERATE = new Set([...MANAGE, 'CAMPAIGN_OPERATOR']);
const READ = new Set([...OPERATE, 'ANALYST', 'MODERATOR']);

export const canReadCampaigns = (role: string): boolean => READ.has(role);
export const canOperateCampaigns = (role: string): boolean => OPERATE.has(role);
export const canManageCampaigns = (role: string): boolean => MANAGE.has(role);
