import { renderEmailShell, EMAIL_TOKENS } from './base';

const { color: C, font: F } = EMAIL_TOKENS;

export interface EmailVerificationVars {
  fullName: string;
  code: string;
  expiresMinutes: number;
  mascotUrl: string;
  logoUrl: string;
  isotypeUrl?: string;
}

export function emailVerificationHtml(v: EmailVerificationVars): string {
  const digits = v.code.split('').map(
    (d) => `<span style="display:inline-block;width:44px;height:56px;line-height:56px;
                         margin:0 4px;border-radius:12px;background:#F5F5F7;
                         font-size:32px;font-weight:700;color:${C.heading};
                         text-align:center;font-family:${F};">${d}</span>`,
  ).join('');

  const contentRows = `<tr>
              <td style="padding-bottom:24px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:700;color:${C.heading};line-height:32px;font-family:${F};">
                  Hola ${v.fullName},
                </p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:600;color:${C.subheading};line-height:28px;font-family:${F};">
                  que bueno tenerte por aquí
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:32px;text-align:center;">
                <p style="margin:0;font-size:16px;font-weight:600;color:${C.body};line-height:26px;font-family:${F};">
                  Ingresa este código en la app para confirmar tu cuenta.
                  Expira en <strong>${v.expiresMinutes} minutos</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:32px;">
                <div style="display:inline-block;">${digits}</div>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:13px;color:${C.muted};line-height:20px;font-family:${F};">
                  Si no creaste una cuenta en Walvy, ignora este correo.
                </p>
              </td>
            </tr>`;

  return renderEmailShell({
    title:      'Confirma tu cuenta en Walvy',
    mascotUrl:  v.mascotUrl,
    logoUrl:    v.logoUrl,
    isotypeUrl: v.isotypeUrl,
    contentRows,
  });
}
