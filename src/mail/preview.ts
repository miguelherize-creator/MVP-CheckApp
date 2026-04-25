/**
 * Genera previews HTML desde las mismas funciones que `MailService`.
 *
 *   npm run preview:email
 *
 * Salida: `src/mail/previews/email-verification.html` y `email-reset.html`
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { emailVerificationHtml } from './templates/email-verification.template';
import { passwordResetHtml } from './templates/password-reset.template';

const OUTPUT_DIR = join(__dirname, 'previews');

const SAMPLE = {
  fullName: 'Juan Pérez',
  verifyUrl:
    'http://localhost:3000/auth/email-verification/confirm/PREVIEW-TOKEN-123',
  resetUrl: 'http://localhost:8081/reset-password?token=PREVIEW-TOKEN-123',
  expiresMinutes: 60,
  mascotUrl:
    'https://wmcikwohegcihyafclco.supabase.co/storage/v1/object/sign/assets/email/login.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80YjI0ZTVhNi1mZDY2LTRiZDMtYjg1MS0yZGVjNWJiNTM1NzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvZW1haWwvbG9naW4ucG5nIiwiaWF0IjoxNzc3MDcxNDExLCJleHAiOjE3Nzc2NzYyMTF9.Tnp57qRYdm5s5ZBkWQZLpQRgW-CGo2rzV0a7oM05FFk',
  logoUrl:
    'https://wmcikwohegcihyafclco.supabase.co/storage/v1/object/sign/assets/email/walvy-logo-horizontal-transparent.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80YjI0ZTVhNi1mZDY2LTRiZDMtYjg1MS0yZGVjNWJiNTM1NzgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvZW1haWwvd2FsdnktbG9nby1ob3Jpem9udGFsLXRyYW5zcGFyZW50LnBuZyIsImlhdCI6MTc3NzA3MTQyNywiZXhwIjoxNzc3Njc2MjI3fQ.8f25BwS7BpFLqFsRfmLHFgCxC-uhqfEgJuhatLXHcM0',
};

/**
 * Si existe `MAIL_ISOTYPE_URL` en `Backend/backend/.env`, el preview la usa
 * (mismo flujo que producción). Si no, los templates usan el SVG `data:` embebido.
 */
function readIsotypeUrlFromEnvFile(): string | undefined {
  try {
    const envPath = join(__dirname, '../..', '.env');
    const raw = readFileSync(envPath, 'utf8');
    const m = raw.match(/^\s*MAIL_ISOTYPE_URL=(.+?)\s*$/m);
    if (!m) return undefined;
    return m[1].replace(/^["']|["']$/g, '').trim() || undefined;
  } catch {
    return undefined;
  }
}

function write(name: string, html: string): void {
  const fullPath = join(OUTPUT_DIR, name);
  writeFileSync(fullPath, html, 'utf8');
  console.log(`OK ${fullPath}`);
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const isotypeUrl = readIsotypeUrlFromEnvFile();

  write(
    'email-verification.html',
    emailVerificationHtml({
      fullName:   SAMPLE.fullName,
      verifyUrl:  SAMPLE.verifyUrl,
      mascotUrl:  SAMPLE.mascotUrl,
      logoUrl:    SAMPLE.logoUrl,
      isotypeUrl: isotypeUrl,
    }),
  );

  write(
    'email-reset.html',
    passwordResetHtml({
      resetUrl:       SAMPLE.resetUrl,
      expiresMinutes: SAMPLE.expiresMinutes,
      mascotUrl:      SAMPLE.mascotUrl,
      logoUrl:        SAMPLE.logoUrl,
      isotypeUrl:     isotypeUrl,
    }),
  );

  if (isotypeUrl) {
    console.log('  (MAIL_ISOTYPE_URL leído de .env — misma imagen que producción)\n');
  } else {
    console.log('  (sin MAIL_ISOTYPE_URL en .env — watermark = SVG embebido data:)\n');
  }
  console.log('Previews generados. Deben coincidir con el HTML que envía MailService.');
}

main();
