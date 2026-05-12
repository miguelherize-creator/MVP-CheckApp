import { renderEmailShell, EMAIL_TOKENS } from './base';

const { color: C } = EMAIL_TOKENS;

/** Aptos es la tipografía de la marca; Segoe UI y Arial como fallback de email. */
const F = "'Aptos','Segoe UI',Helvetica,Arial,sans-serif";

// Dos bloques de 3 dígitos separados por espacio, p. ej. `123 456`.
function formatOtpTwoBlocks(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return code.trim();
}

export interface EmailVerificationVars {
  code: string;
  expiresMinutes: number;
  mascotUrl: string;
  logoUrl: string;
  isotypeUrl?: string;
}

export function emailVerificationHtml(v: EmailVerificationVars): string {
  const otpDisplay = formatOtpTwoBlocks(v.code);

  const contentRows = `
            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:600;color:${C.heading};line-height:32px;font-family:${F};">
                  Hola
                </p>
                <p style="margin:0;font-size:20px;font-weight:600;color:${C.subheading};line-height:normal;font-family:${F};">
                  que bueno tenerte por aquí
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:16px;font-weight:600;color:${C.body};line-height:24px;font-family:${F};">
                  Usa este código para confirmar tu cuenta y seguir<br />poniendo tu mes en claro.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:40px;">
                <p style="margin:0;font-size:24px;font-weight:700;color:${C.heading};line-height:32px;font-family:${F};text-align:center;">
                  ${otpDisplay}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:16px;font-weight:600;color:${C.body};line-height:24px;font-family:${F};">
                  Ingresa este código en la app para continuar.<br />
                  Expira en <strong>${v.expiresMinutes} minutos</strong>.
                </p>
              </td>
            </tr>`;

  const postDividerRows = `<tr>
              <td style="padding-bottom:12px;text-align:center;">
                <p style="margin:0;font-size:12px;font-weight:400;color:${C.muted};line-height:normal;font-family:${F};">
                  Si no solicitaste este código, puedes ignorar este correo.
                </p>
                <p style="margin:2px 0 0;font-size:12px;font-weight:400;color:${C.muted};line-height:normal;font-family:${F};">
                  Este es un correo generado de forma automática, por favor no respondas este mensaje.
                </p>
              </td>
            </tr>`;

  return renderEmailShell({
    title:      'Confirma tu cuenta en Walvy',
    mascotUrl:  v.mascotUrl,
    logoUrl:    v.logoUrl,
    isotypeUrl: v.isotypeUrl,
    contentRows,
    postDividerRows,
    omitFooterDisclaimer: true,
  });
}
