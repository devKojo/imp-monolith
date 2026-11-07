export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128; // bounds hashing cost

/** Returns a list of problems; empty means acceptable. Breach checking is a separate port. */
export function passwordProblems(password: string, email: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push(`must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }
  const local = email.split('@')[0] ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    problems.push('must not contain your email name');
  }
  if (/^(.)\1+$/.test(password)) problems.push('must not be a single repeated character');
  return problems;
}
