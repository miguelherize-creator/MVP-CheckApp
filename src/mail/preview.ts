/**
 * Genera previews HTML desde las mismas funciones que `MailService`.
 *
 *   npm run preview:email
 *
 * Salida: `src/mail/previews/email-verification.html` y `email-reset.html`.
 *
 * ─── URLs de imágenes ─────────────────────────────────────────────────────
 * Mascota, logo e isotipo se leen de `.env` (`MAIL_MASCOT_URL`, `MAIL_LOGO_URL`,
 * `MAIL_ISOTYPE_URL`), incluyendo valores con `${MAIL_SUPABASE_STORAGE_SIGN_BASE}`.
 *
 * Si falta `.env` o alguna clave, se usan los mismos defaults que `MailService`.
 *
 * ─── Watermark / isotipo ───────────────────────────────────────────────────
 * Por defecto el preview NO pasa `isotypeUrl` → `base.ts` usa el SVG embebido
 * (carga segura en el navegador). Para usar `MAIL_ISOTYPE_URL` del `.env`:
 *   USE_ENV_ISOTYPE=1 npm run preview:email
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { emailVerificationHtml } from './templates/email-verification.template';
import { passwordResetHtml } from './templates/password-reset.template';

const OUTPUT_DIR = join(__dirname, 'previews');

/** Mismos defaults que `MailService` cuando no hay Config. */
const DEFAULT_MASCOT = 'https://walvy.app/assets/mascot-email.png';
const DEFAULT_LOGO   = 'https://walvy.app/assets/walvy-logo-horizontal.png';

const SAMPLE = {
  code: '482910',
  resetUrl: 'http://localhost:8081/reset-password?token=PREVIEW-TOKEN-123',
  expiresMinutes: 60,
};

function parseDotEnv(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

/** Resuelve `${VAR}` en valores (p. ej. `MAIL_MASCOT_URL=${MAIL_SUPABASE_…}/…`). */
function expandVariables(vars: Record<string, string>): Record<string, string> {
  const result = { ...vars };
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (const key of Object.keys(result)) {
      const next = result[key].replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
        (full, refKey: string) => {
          const ref = result[refKey];
          return ref !== undefined ? ref : full;
        },
      );
      if (next !== result[key]) {
        result[key] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

function loadMailUrlsFromEnvFile(): {
  mascotUrl?: string;
  logoUrl?: string;
  isotypeUrl?: string;
} {
  try {
    const envPath = join(__dirname, '../..', '.env');
    const raw = readFileSync(envPath, 'utf8');
    const expanded = expandVariables(parseDotEnv(raw));
    return {
      mascotUrl: expanded.MAIL_MASCOT_URL?.trim() || undefined,
      logoUrl: expanded.MAIL_LOGO_URL?.trim() || undefined,
      isotypeUrl: expanded.MAIL_ISOTYPE_URL?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

function write(name: string, html: string): void {
  const fullPath = join(OUTPUT_DIR, name);
  writeFileSync(fullPath, html, 'utf8');
  console.log(`OK ${fullPath}`);
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const env = loadMailUrlsFromEnvFile();
  const mascotUrl = env.mascotUrl ?? DEFAULT_MASCOT;
  const logoUrl = env.logoUrl ?? DEFAULT_LOGO;

  const useEnvIsotype = process.env.USE_ENV_ISOTYPE === '1';
  const isotypeUrl = useEnvIsotype ? env.isotypeUrl : undefined;

  write(
    'email-verification.html',
    emailVerificationHtml({
      code:           SAMPLE.code,
      expiresMinutes: SAMPLE.expiresMinutes,
      mascotUrl,
      logoUrl,
      isotypeUrl,
    }),
  );

  write(
    'email-reset.html',
    passwordResetHtml({
      resetUrl:       SAMPLE.resetUrl,
      expiresMinutes: SAMPLE.expiresMinutes,
      mascotUrl,
      logoUrl,
      isotypeUrl,
    }),
  );

  const src =
    env.mascotUrl && env.logoUrl
      ? 'MAIL_MASCOT_URL / MAIL_LOGO_URL desde .env'
      : 'defaults (falta .env o claves)';

  console.log(`  (imágenes: ${src})`);

  if (useEnvIsotype) {
    if (env.isotypeUrl) {
      console.log('  (USE_ENV_ISOTYPE=1 — watermark = MAIL_ISOTYPE_URL del .env)\n');
    } else {
      console.log(
        '  (USE_ENV_ISOTYPE=1 pero MAIL_ISOTYPE_URL no está en .env — fallback a SVG data:)\n',
      );
    }
  } else {
    console.log('  (watermark = SVG embebido data: — siempre carga en el navegador)\n');
    console.log('  Tip: USE_ENV_ISOTYPE=1 npm run preview:email para usar MAIL_ISOTYPE_URL.');
  }
  console.log('Previews generados.');
}

main();
