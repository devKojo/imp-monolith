/**
 * Mirrors the API's role rules so the screen only offers what will work. The server decides: this
 * keeps buttons honest, it does not protect anything.
 */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);

export const canManageCampaigns = (role: string | undefined): boolean =>
  role !== undefined && MANAGE.has(role);

/** Operators can also pause and resume a running campaign. */
export const canOperateCampaigns = (role: string | undefined): boolean =>
  canManageCampaigns(role) || role === 'CAMPAIGN_OPERATOR';
