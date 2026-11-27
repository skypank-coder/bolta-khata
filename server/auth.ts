import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Accounts are a mobile number and a 4–6 digit PIN, like a UPI PIN that
 * every SHG member already knows how to use. PINs are stored only as scrypt
 * hashes; sessions are random tokens stored only as SHA-256 hashes.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const got = await scrypt(pin, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(got, expected);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');
export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString('base64url')}`;

/** Six easy-to-say characters (no 0/O, 1/I) for sharing a group with a worker or bank. */
export function newJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

/** Indian mobile numbers: 10 digits starting 6–9; "+91" or a leading 0 is accepted. */
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4,6}$/.test(pin);

/** Five wrong PINs in ten minutes locks that number (and that address) for the rest of the window. */
export class LoginLimiter {
  private hits = new Map<string, number[]>();
  private max: number;
  private windowMs: number;
  constructor(max = 5, windowMs = 10 * 60 * 1000) {
    this.max = max;
    this.windowMs = windowMs;
  }

  blocked(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, recent);
    return recent.length >= this.max;
  }
  fail(key: string, now = Date.now()) {
    this.hits.set(key, [...(this.hits.get(key) ?? []), now]);
  }
  clear(key: string) {
    this.hits.delete(key);
  }
}
