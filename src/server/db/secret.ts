// Server-side signing and encryption for the keyless (memory) deployment mode. SERVER ONLY.
// SESSION_SECRET must be set in production; dev and tests use a fixed fallback.
import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function secretKey(): Buffer {
  const raw = process.env.SESSION_SECRET || 'greenlit-dev-only-secret-do-not-use-in-production';
  return createHash('sha256').update(raw).digest();
}

const b64url = (b: Buffer) => b.toString('base64url');

export function sign(payload: string): string {
  const mac = createHmac('sha256', secretKey()).update(payload).digest();
  return `${b64url(Buffer.from(payload))}.${b64url(mac.subarray(0, 18))}`;
}

export function verify(token: string): string | null {
  const [p, m] = token.split('.');
  if (!p || !m) return null;
  const payload = Buffer.from(p, 'base64url').toString();
  const expected = createHmac('sha256', secretKey()).update(payload).digest().subarray(0, 18);
  const got = Buffer.from(m, 'base64url');
  return got.length === expected.length && timingSafeEqual(got, expected) ? payload : null;
}

/** AES-256-GCM, output is base64url and contains no recognizable plaintext. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secretKey(), iv);
  const body = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return b64url(Buffer.concat([iv, c.getAuthTag(), body]));
}

export function decrypt(token: string): string | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 29) return null;
    const d = createDecipheriv('aes-256-gcm', secretKey(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
