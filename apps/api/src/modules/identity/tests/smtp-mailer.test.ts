import { describe, expect, it, vi } from 'vitest';
import { SmtpMailer } from '../infrastructure/smtp-mailer';

describe('SmtpMailer', () => {
  it('sends the verification link built from the public URL', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const mailer = new SmtpMailer({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'sender@gmail.test',
      pass: 'app-password',
      from: 'IMP <sender@gmail.test>',
      publicUrl: 'https://imp.example.test/',
      transport: { sendMail } as never,
    });
    await mailer.sendVerificationEmail('pat@example.com', 'tok/en+1');
    const msg = sendMail.mock.calls[0]![0] as { to: string; from: string; text: string };
    expect(msg.to).toBe('pat@example.com');
    expect(msg.from).toBe('IMP <sender@gmail.test>');
    expect(msg.text).toContain('https://imp.example.test/verify-email?token=tok%2Fen%2B1');
  });
});
