import { renderEmailShell, EMAIL_TOKENS } from './base';

const { color: C, font: F } = EMAIL_TOKENS;

export interface EmailVerificationVars {
  fullName: string;
  verifyUrl: string;
  mascotUrl: string;
  logoUrl: string;
  /** Watermark (Supabase). Si falta, `base` usa SVG embebido `data:`. */
  isotypeUrl?: string;
}

export function emailVerificationHtml(v: EmailVerificationVars): string {
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
                <p class="body-text" style="margin:0;font-size:16px;font-weight:600;color:${C.body};line-height:26px;font-family:${F};">
                  Estamos listos para ayudarte a organizar tus deudas y que tu sueldo rinda más. Pero primero confirmemos tu cuenta.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:32px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                             xmlns:w="urn:schemas-microsoft-com:office:word"
                             href="${v.verifyUrl}" style="height:48px;width:260px;v-text-anchor:middle;"
                             arcsize="50%" fillcolor="${C.primary}" strokecolor="${C.primary}">
                  <w:anchorlock/>
                  <center style="color:${C.textOnDark};font-size:16px;font-weight:700;">
                    Confirmar mi cuenta
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a class="cta-btn" href="${v.verifyUrl}"
                   style="display:inline-block;background-color:${C.primary};color:${C.textOnDark};font-family:${F};
                          font-size:16px;font-weight:700;text-decoration:none;border-radius:100px;padding:14px 48px;
                          min-width:220px;text-align:center;mso-hide:all;">
                  Confirmar mi cuenta
                </a>
                <!--<![endif]-->
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0 0 12px;font-size:14px;color:${C.muted};font-weight:600;line-height:20px;font-family:${F};">
                  Si lo prefieres, copia y pega este enlace en tu navegador
                </p>
                <a class="alt-link" href="${v.verifyUrl}"
                   style="font-size:13px;color:${C.link};text-decoration:underline;word-break:break-all;line-height:20px;font-family:${F};">
                  ${v.verifyUrl}
                </a>
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
