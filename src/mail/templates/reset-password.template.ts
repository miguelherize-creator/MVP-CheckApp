export function buildResetPasswordTemplate(
  resetUrl: string,
  expiresMinutes: number,
) {
  const subject = 'Recupera tu contraseña en Walvy';

  const html = `
  <!DOCTYPE html>
  <html lang="es">
    <body style="margin:0;padding:0;background:#0f1720;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1720;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#18222d;border-radius:16px;padding:32px;">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <h1 style="margin:0;color:#ffffff;font-size:28px;">Walvy</h1>
                  <p style="margin:8px 0 0;color:#8fa3b8;font-size:14px;">Tu flujo, tu control</p>
                </td>
              </tr>

              <tr>
                <td>
                  <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;">
                    Recuperación de contraseña
                  </h2>

                  <p style="margin:0 0 16px;color:#d1d5db;font-size:15px;">
                    Recibimos una solicitud para restablecer tu contraseña.
                  </p>

                  <p style="margin:0 0 24px;color:#d1d5db;font-size:15px;">
                    Haz clic en el botón para continuar:
                  </p>

                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" bgcolor="#18b6b0" style="border-radius:10px;">
                        <a href="${resetUrl}"
                           style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:bold;">
                          Restablecer contraseña
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin-top:24px;color:#8fa3b8;font-size:13px;">
                    Este enlace expira en ${expiresMinutes} minutos.
                  </p>

                  <p style="margin-top:16px;color:#8fa3b8;font-size:12px;">
                    ${resetUrl}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  const text = `
Recuperación de contraseña - Walvy

Usa este enlace:
${resetUrl}

Expira en ${expiresMinutes} minutos.
`;

  return { subject, html, text };
}