import { renderEmailShell, EMAIL_TOKENS } from './base';

const { color: C } = EMAIL_TOKENS;

const F = "'Aptos','Segoe UI',Helvetica,Arial,sans-serif";

function formatOtpTwoBlocks(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return code.trim();
}

export interface PasswordResetOtpVars {
  code: string;
  expiresMinutes: number;
  mascotUrl: string;
  logoUrl: string;
  isotypeUrl?: string;
}

export function passwordResetOtpHtml(v: PasswordResetOtpVars): string {
  const otpDisplay = formatOtpTwoBlocks(v.code);

  const contentRows = `
            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:600;color:${C.heading};line-height:32px;font-family:${F};">
                  ¿Olvidaste tu contraseña?
                </p>
                <p style="margin:0;font-size:20px;font-weight:600;color:${C.subheading};line-height:normal;font-family:${F};">
                  no pasa nada, te ayudamos
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:16px;font-weight:600;color:${C.body};line-height:24px;font-family:${F};">
                  Usa este código para restablecer tu contraseña<br />y volver a poner tu mes en claro.
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
                  Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
                </p>
                <p style="margin:2px 0 0;font-size:12px;font-weight:400;color:${C.muted};line-height:normal;font-family:${F};">
                  Este es un correo generado de forma automática, por favor no respondas este mensaje.
                </p>
              </td>
            </tr>`;

  return renderEmailShell({
    title:      'Restablece tu contraseña en Walvy',
    mascotUrl:  v.mascotUrl,
    logoUrl:    v.logoUrl,
    isotypeUrl: v.isotypeUrl,
    contentRows,
    postDividerRows,
    omitFooterDisclaimer: true,
  });
}
