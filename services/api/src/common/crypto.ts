import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function generateToken(): string {
  return randomBytes(48).toString('base64url');
}
