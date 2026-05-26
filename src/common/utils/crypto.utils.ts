import { createHash, randomBytes } from 'crypto';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

/** Código OTP numérico de 6 dígitos con distribución uniforme. */
export function generateSixDigitCode(): string {
  const num = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, '0');
}
