/**
 * Shapes returned by the identity API (apps/api modules/identity, MODULE.md). Hand-written for now:
 * replace with the client generated from packages/contracts when that package exists (R-STK-04).
 */
export type Role =
  | 'BUSINESS_OWNER'
  | 'BUSINESS_ADMINISTRATOR'
  | 'CAMPAIGN_MANAGER'
  | 'CAMPAIGN_OPERATOR'
  | 'ANALYST'
  | 'MODERATOR';

export type MembershipSummary = {
  membershipId: string;
  tenantId: string;
  businessName: string;
  role: Role;
};

/** Which sign-in page was used. A participant account never opens the business portal. */
export type Portal = 'participant' | 'business';
export type AccountType = 'BUSINESS' | 'PARTICIPANT';

export type SessionInfo = {
  user: { name: string; email: string; emailVerified: boolean; accountType: AccountType };
  active: { membershipId: string; tenantId: string; role: Role } | null;
  memberships: MembershipSummary[];
  /** Session-bound CSRF token; sent as X-CSRF-Token on authenticated state-changing requests. */
  csrfToken: string;
};

export type LoginResult = {
  csrfToken: string;
  accountType: AccountType;
  memberships: MembershipSummary[];
  activeMembershipId: string | null;
};

export type RegisterParticipantInput = {
  name: string;
  email: string;
  password: string;
  agreement: { accepted: true; version: string };
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  businessName: string;
  agreement: { accepted: true; version: string };
};
