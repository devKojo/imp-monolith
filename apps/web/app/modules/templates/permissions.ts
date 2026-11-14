/**
 * Mirrors the API's role rule so the screen only offers what will work. The server decides: this
 * keeps buttons honest, it does not protect anything.
 */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);

export const canManageTemplates = (role: string | undefined): boolean =>
  role !== undefined && MANAGE.has(role);
