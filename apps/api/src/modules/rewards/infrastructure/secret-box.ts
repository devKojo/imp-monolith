import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Encrypts the few values that must be readable later but never stored or logged in clear (a payout
 * destination). AES-256-GCM with a fresh random IV for every value, so equal inputs give different
 * ciphertexts and any change to the stored text is detected. The key is derived from a server secret and
 * is never stored in the database.
 */
export class SecretBox {
  private readonly key: Buffer;
  private readonly macKey: Buffer;

  constructor(secret: string) {
    if (secret.length < 16) throw new Error('The rewards data key is too short');
    // Separate keys for encryption and for the lookup hash, both derived from the one secret.
    this.key = createHash('sha256').update(`enc|${secret}`).digest();
    this.macKey = createHash('sha256').update(`mac|${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      body.toString('base64'),
    ].join(':');
  }

  /** Throws if the value was altered or was made with another key. */
  decrypt(sealed: string): string {
    const [v, iv, tag, body] = sealed.split(':');
    if (v !== 'v1' || !iv || !tag || !body) throw new Error('Unrecognised sealed value');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString(
      'utf8',
    );
  }

  /** A keyed, one-way fingerprint: equal values match, without being able to read them back. */
  fingerprint(value: string): string {
    return createHmac('sha256', this.macKey).update(value).digest('hex').slice(0, 32);
  }
}
