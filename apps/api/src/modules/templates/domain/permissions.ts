/**
 * Who can do what with templates. Reading is open to every role in the business; changing,
 * publishing and deleting is for the people who run campaigns. The role comes from the session's
 * active membership, never from the request.
 */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);
const READ = new Set([...MANAGE, 'CAMPAIGN_OPERATOR', 'ANALYST', 'MODERATOR']);

export const canReadTemplates = (role: string): boolean => READ.has(role);
export const canManageTemplates = (role: string): boolean => MANAGE.has(role);
