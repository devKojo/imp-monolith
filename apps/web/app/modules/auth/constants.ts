/**
 * Version of the agreement (terms of service + data processing addendum) shown at registration.
 * It is recorded server-side with the acceptance (R-PRV-01), so change it whenever the published
 * text changes. Replace with the content hash of the published documents when they exist (R-PRV-03).
 */
export const AGREEMENT_VERSION = '1.0';

export const BRAND_NAME = 'Interactive Marketing Platform';

/** Seconds before a page that auto-retries after a 429/503 tries again. */
export const MIN_RETRY_SECONDS = 1;
