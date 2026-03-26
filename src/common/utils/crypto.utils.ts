import { createHash, randomBytes } from 'crypto';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}
