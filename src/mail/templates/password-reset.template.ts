import { renderEmailShell, EMAIL_TOKENS } from './base';

const { color: C, font: F } = EMAIL_TOKENS;

export interface PasswordResetVars {
  resetUrl: string;
  expiresMinutes: number;
  mascotUrl: string;
  logoUrl: string;
  isotypeUrl?: string;
}

export function passwordResetHtml(v: PasswordResetVars): string {
  const contentRows = `<tr>
              <td style="padding-bottom:24px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:700;color:${C.heading};line-height:32px;font-family:${F};">
                  Recupera tu contraseña
                </p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:600;color:${C.subheading};line-height:28px;font-family:${F};">
                  estamos aquí para ayudarte
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:32px;text-align:center;">
                <p class="body-text" style="margin:0;font-size:16px;font-weight:600;color:${C.body};line-height:26px;font-family:${F};">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta Walvy. Haz clic en el botón y sigue los pasos. El enlace expira en <strong>${v.expiresMinutes} minutos</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:32px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                             xmlns:w="urn:schemas-microsoft-com:office:word"
                             href="${v.resetUrl}" style="height:48px;width:280px;v-text-anchor:middle;"
                             arcsize="50%" fillcolor="${C.primary}" strokecolor="${C.primary}">
                  <w:anchorlock/>
                  <center style="color:${C.textOnDark};font-size:16px;font-weight:700;">
                    Restablecer contraseña
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a class="cta-btn" href="${v.resetUrl}"
                   style="display:inline-block;background-color:${C.primary};color:${C.textOnDark};font-family:${F};
                          font-size:16px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 48px;
                          min-width:220px;text-align:center;mso-hide:all;">
                  Restablecer contraseña
                </a>
                <!--<![endif]-->
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:32px;text-align:center;">
                <p style="margin:0 0 12px;font-size:14px;color:${C.muted};font-weight:600;line-height:20px;font-family:${F};">
                  Si lo prefieres, copia y pega este enlace en tu navegador
                </p>
                <a class="alt-link" href="${v.resetUrl}"
                   style="font-size:13px;color:${C.link};text-decoration:underline;word-break:break-all;line-height:20px;font-family:${F};">
                  ${v.resetUrl}
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:8px;text-align:center;">
                <p style="margin:0;font-size:13px;color:${C.muted};line-height:20px;font-family:${F};">
                  Si no solicitaste este cambio, ignora este correo. Tu contraseña permanecerá sin cambios.
                </p>
              </td>
            </tr>`;

  return renderEmailShell({
    title:      'Recupera tu contraseña — Walvy',
    mascotUrl:  v.mascotUrl,
    logoUrl:    v.logoUrl,
    isotypeUrl: v.isotypeUrl,
    contentRows,
  });
}
