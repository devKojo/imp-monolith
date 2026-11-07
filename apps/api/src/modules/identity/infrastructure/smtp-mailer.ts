import { createTransport, type Transporter } from 'nodemailer';
import type { Mailer } from '../application/ports';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** Display From header; defaults to the authenticated address. */
  from?: string | undefined;
  /** Public site origin used to build links. */
  publicUrl: string;
  transport?: Transporter;
};

/**
 * Sends transactional mail through SMTP (Gmail: smtp.gmail.com with an App Password). Addresses
 * are never logged (R-PRV-06).
 */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(private readonly cfg: SmtpConfig) {
    this.transport =
      cfg.transport ??
      createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const base = this.cfg.publicUrl.replace(/\/$/, '');
    const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
    await this.transport.sendMail({
      from: this.cfg.from ?? this.cfg.user,
      to,
      subject: 'Verify your email address',
      text: `Welcome to IMP.\n\nConfirm your email address by opening this link (valid for 24 hours):\n${link}\n\nIf you did not create an account, you can ignore this email.`,
      html: `<p>Welcome to IMP.</p><p><a href="${link}">Confirm your email address</a> (valid for 24 hours).</p><p>If you did not create an account, you can ignore this email.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const base = this.cfg.publicUrl.replace(/\/$/, '');
    const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    await this.transport.sendMail({
      from: this.cfg.from ?? this.cfg.user,
      to,
      subject: 'Reset your password',
      text: `We received a request to reset your IMP password.\n\nChoose a new password by opening this link (valid for 1 hour, works once):\n${link}\n\nIf you did not ask for this, ignore this email. Your password stays the same.`,
      html: `<p>We received a request to reset your IMP password.</p><p><a href="${link}">Choose a new password</a> (valid for 1 hour, works once).</p><p>If you did not ask for this, ignore this email. Your password stays the same.</p>`,
    });
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    await this.transport.sendMail({
      from: this.cfg.from ?? this.cfg.user,
      to,
      subject: 'Your password was changed',
      text: 'The password for your IMP account was just changed, and you were signed out everywhere.\n\nIf this was you, no action is needed. If it was not, reset your password again right away.',
      html: '<p>The password for your IMP account was just changed, and you were signed out everywhere.</p><p>If this was you, no action is needed. If it was not, reset your password again right away.</p>',
    });
  }
}
