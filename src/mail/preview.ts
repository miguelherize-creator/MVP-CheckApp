/**
 * Genera previews HTML desde las mismas funciones que `MailService`.
 *
 *   npm run preview:email
 *
 * Salida: `src/mail/previews/email-verification.html` y `email-reset.html`.
 *
 * ─── Nota sobre el watermark ────────────────────────────────────────────────
 * En producción (correo real) `MAIL_ISOTYPE_URL` debe ser un **PNG público**
 * (Gmail/Outlook bloquean SVG como `<img>`/`background-image`).
 *
 * Para los previews en el navegador NO usamos esa URL: dejamos que `base.ts`
 * caiga al SVG embebido (`data:image/svg+xml;…`). Los navegadores sí lo
 * renderizan, y así el preview siempre carga aunque la URL de Supabase esté
 * caída/expirada.
 *
 * Si quieres ver cómo queda con la URL real de producción, ejecuta:
 *   USE_ENV_ISOTYPE=1 npm run preview:email
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

/** Lee `MAIL_ISOTYPE_URL` del `.env` (solo si `USE_ENV_ISOTYPE=1`). */
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

  const useEnv = process.env.USE_ENV_ISOTYPE === '1';
  const isotypeUrl = useEnv ? readIsotypeUrlFromEnvFile() : undefined;

  write(
    'email-verification.html',
    emailVerificationHtml({
      fullName:   SAMPLE.fullName,
      verifyUrl:  SAMPLE.verifyUrl,
      mascotUrl:  SAMPLE.mascotUrl,
      logoUrl:    SAMPLE.logoUrl,
      isotypeUrl,
    }),
  );

  write(
    'email-reset.html',
    passwordResetHtml({
      resetUrl:       SAMPLE.resetUrl,
      expiresMinutes: SAMPLE.expiresMinutes,
      mascotUrl:      SAMPLE.mascotUrl,
      logoUrl:        SAMPLE.logoUrl,
      isotypeUrl,
    }),
  );

  if (useEnv) {
    if (isotypeUrl) {
      console.log('  (USE_ENV_ISOTYPE=1 — watermark = MAIL_ISOTYPE_URL del .env)\n');
    } else {
      console.log('  (USE_ENV_ISOTYPE=1 pero MAIL_ISOTYPE_URL no está en .env — fallback a SVG data:)\n');
    }
  } else {
    console.log('  (watermark = SVG embebido data: — siempre carga en el navegador)\n');
    console.log('  Tip: USE_ENV_ISOTYPE=1 npm run preview:email para usar la URL real.');
  }
  console.log('Previews generados.');
}

main();
