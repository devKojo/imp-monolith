import type { Mailer } from '../application/ports';

/**
 * Development mailer: prints the verification token (never the address, logs are PII-free,
 * R-PRV-06). Replace with the notifications module's transactional mail before any real use.
 */
export class ConsoleMailer implements Mailer {
  async sendVerificationEmail(_to: string, token: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ConsoleMailer must not be used in production');
    }
    console.warn(`[dev mailer] email verification token: ${token}`);
  }
}
