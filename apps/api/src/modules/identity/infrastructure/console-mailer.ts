import type { Mailer } from '../application/ports';

/**
 * Development mailer: prints tokens (never the address, logs are PII-free, R-PRV-06). Replace with
 * the notifications module's transactional mail before any real use.
 */
export class ConsoleMailer implements Mailer {
  private assertNotProduction() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ConsoleMailer must not be used in production');
    }
  }

  async sendVerificationEmail(_to: string, token: string): Promise<void> {
    this.assertNotProduction();
    console.warn(`[dev mailer] email verification token: ${token}`);
  }

  async sendPasswordResetEmail(_to: string, token: string): Promise<void> {
    this.assertNotProduction();
    console.warn(`[dev mailer] password reset token: ${token}`);
  }

  async sendPasswordChangedEmail(): Promise<void> {
    this.assertNotProduction();
    console.warn('[dev mailer] password changed notice');
  }
}
