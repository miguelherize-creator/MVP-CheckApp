/**
 * Shell común de los correos de Walvy.
 *
 * Centraliza head, watermark del isotipo (como BACKGROUND IMAGE, no como
 * `<img>` posicionado), header (mascota + logo centrado), divisores coral y
 * footer. Los templates concretos solo componen `contentRows` (las filas
 * `<tr>…</tr>` del cuerpo entre los dos divisores).
 *
 * ─── Watermark / fondo del correo ────────────────────────────────────────────
 * Antes se usaba `<img class="iso-watermark" style="position:absolute;...">`
 * pero eso NO funciona en email:
 *   • Gmail elimina/ignora `position:absolute` declarado en `<style>`, así que
 *     el `<img>` cae al flujo normal y aparece como una imagen suelta arriba,
 *     antes del contenido.
 *   • Gmail/Outlook bloquean imágenes SVG en `<img src="…svg">`.
 *
 * Solución: técnica "bulletproof background image" — la imagen se aplica como
 * fondo del `<td>` que contiene el correo combinando 3 fallbacks:
 *   1. atributo HTML `background="…"` (Outlook 2007+ y otros viejos)
 *   2. inline CSS `background-image:url(…)` (Apple Mail, Gmail, iOS, etc.)
 *   3. VML `<v:rect>` + `<v:fill>` para Outlook desktop
 *
 * IMPORTANTE: para producción `MAIL_ISOTYPE_URL` debe apuntar a un PNG público
 * (no SVG), porque la mayoría de clientes de correo bloquean SVG. Para el
 * preview en el navegador se usa el SVG embebido como `data:` URI (los
 * navegadores sí lo renderizan).
 */

const COLOR = {
  bg:         '#FAF9F6',
  primary:    '#1B6B73',
  textOnDark: '#FFFCFA',
  heading:    '#103F43',
  subheading: 'rgba(0,82,89,0.8)',
  body:       '#1F2A33',
  muted:      'rgba(31,42,51,0.8)',
  link:       '#369EA7',
  divider:    '#EE8D78',
  blobTeal:   '#2A9DA8',
  blobCoral:  '#FF5530',
} as const;

const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";

/** Tamaño visual del watermark en píxeles (cuadrado). */
const WATERMARK_SIZE = 720;

/** Mismo vector que `assets/walvy-isotype-blob.svg` (opacity 0.1, blur 60). */
function buildIsotypeBlobSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1225 1236" fill="none" preserveAspectRatio="xMidYMid meet">
<g opacity="0.1" filter="url(#walvyBlobBlur)">
<path d="M1004.74 156.139C1013.23 128.952 1042.03 113.843 1069.06 122.388C1096.09 130.934 1111.12 159.907 1102.63 187.097L876.905 909.575C870.751 929.272 853.513 943.384 833.091 945.449C812.668 947.514 792.983 937.132 783.056 919.06L612.493 608.581L441.931 919.06C432.004 937.13 412.33 947.512 391.91 945.449C371.488 943.384 354.25 929.272 348.096 909.575L122.374 187.097C113.88 159.909 128.9 130.936 155.925 122.388C182.953 113.844 211.754 128.953 220.251 156.139L410.06 763.688L567.596 476.929L569.388 473.925C578.787 459.261 594.991 450.289 612.493 450.288C631.162 450.288 648.358 460.493 657.391 476.929L814.913 763.674L1004.74 156.139Z" fill="${COLOR.blobTeal}"/>
<path d="M894.483 970.602C909.148 961.957 928.006 966.901 936.602 981.652C945.198 996.405 940.269 1015.37 925.604 1024.02C822.465 1084.84 717.974 1116 612.504 1116C507.031 1116 402.531 1084.84 299.39 1024.02C284.726 1015.37 279.809 996.404 288.406 981.652C297.003 966.901 315.86 961.954 330.525 970.602C425.746 1026.75 519.615 1054.09 612.504 1054.09C705.392 1054.08 799.263 1026.75 894.483 970.602Z" fill="${COLOR.blobCoral}"/>
</g>
<defs>
<filter id="walvyBlobBlur" x="-100" y="-100" width="1425" height="1436" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="60" result="blur"/>
</filter>
</defs>
</svg>`;
}

/**
 * Codifica un SVG como `data:image/svg+xml;utf8,…` seguro para usar a la vez
 * en atributos HTML (`background="…"`, `src="…"` doble-comilla) y en CSS
 * (`background-image:url('…')` con comilla simple). La clave: NO dejar
 * comillas simples ni dobles dentro de la URI.
 */
function svgToDataUri(svg: string): string {
  const encoded = svg
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/&/g, '%26')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/"/g, '%22')
    .replace(/'/g, '%27');
  return `data:image/svg+xml;utf8,${encoded}`;
}

const ISOTYPE_DATA_URI = svgToDataUri(buildIsotypeBlobSvg());

export function dividerRow(paddingBottom: number): string {
  return `<tr>
              <td style="border-top:1px solid ${COLOR.divider};padding-bottom:${paddingBottom}px;line-height:0;font-size:0;">&nbsp;</td>
            </tr>`;
}

function headerRow(mascotUrl: string, logoUrl: string): string {
  return `<tr>
              <td style="padding:0 0 24px 0;" align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td valign="middle" style="padding-right:16px;">
                      <img class="mascot-img"
                           src="${mascotUrl}"
                           alt="Walvy mascota"
                           width="74" height="120"
                           style="display:block;border:0;width:74px;height:120px;object-fit:contain;" />
                    </td>
                    <td valign="middle">
                      <img class="logo-img"
                           src="${logoUrl}"
                           alt="Walvy"
                           width="200" height="63"
                           style="display:block;border:0;width:200px;height:63px;object-fit:contain;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function footerDisclaimerRow(): string {
  return `<tr>
              <td style="padding-bottom:12px;text-align:center;">
                <p style="margin:0;font-size:12px;font-weight:400;color:${COLOR.muted};line-height:normal;font-family:${FONT};">
                  Este es un correo generado de forma automática, por favor no respondas este mensaje.
                </p>
              </td>
            </tr>`;
}

function footerSignOffRow(): string {
  return `<tr>
              <td style="padding-bottom:40px;text-align:center;">
                <p style="margin:0;font-size:16px;color:${COLOR.muted};line-height:24px;font-family:${FONT};">
                  Saludos,<br />
                  El equipo de Walvy
                </p>
              </td>
            </tr>`;
}

function footerRows(omitDisclaimer: boolean | undefined): string {
  return `${omitDisclaimer ? '' : footerDisclaimerRow()}${footerSignOffRow()}`;
}

export interface EmailShellOptions {
  title: string;
  mascotUrl: string;
  logoUrl: string;
  /** URL pública del isotipo usado como watermark. Si falta, usa SVG embebido. */
  isotypeUrl?: string;
  contentRows: string;
  /** Filas `<tr>` extra antes del pie estándar. */
  postDividerRows?: string;
  /** Omite la fila «correo automático» del pie cuando ya está en `postDividerRows`. */
  omitFooterDisclaimer?: boolean;
}

export function renderEmailShell(opts: EmailShellOptions): string {
  const watermarkSrc = opts.isotypeUrl?.trim() || ISOTYPE_DATA_URI;

  // background-position: center top mantiene el watermark visible cerca del header.
  // background-size: 720px con fallback a "auto" para clientes que no soportan size.
  const bgStyle =
    `background-color:${COLOR.bg};` +
    `background-image:url('${watermarkSrc}');` +
    `background-position:center top;` +
    `background-repeat:no-repeat;` +
    `background-size:${WATERMARK_SIZE}px ${WATERMARK_SIZE}px;`;

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${opts.title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { -ms-interpolation-mode: bicubic; border: 0; display: block; outline: none; text-decoration: none; }
    a { color: inherit; }
    @media screen and (max-width: 600px) {
      .outer-table  { padding: 16px 8px !important; }
      .inner-table  { width: 100% !important; }
      .mascot-img   { width: 56px !important; height: 91px !important; }
      .logo-img     { width: 160px !important; height: 50px !important; }
      .cta-btn      { padding: 14px 24px !important; font-size: 15px !important; }
      .alt-link     { font-size: 12px !important; }
      .body-text    { font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.bg};font-family:${FONT};">

  <!--
    Wrapper table con el watermark como background image.
    - Atributo HTML "background" -> Outlook 2007+ y otros clientes legacy.
    - inline CSS "background-image" -> Apple Mail, Gmail web/iOS, Yahoo, etc.
    - bgcolor -> fallback puro si la imagen no carga.
  -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         bgcolor="${COLOR.bg}" background="${watermarkSrc}"
         style="${bgStyle}">
    <tr>
      <td align="center" valign="top" style="padding:0;">

        <!--[if gte mso 9]>
        <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
                style="mso-width-percent:1000;height:${WATERMARK_SIZE}px;">
          <v:fill type="frame" src="${watermarkSrc}" color="${COLOR.bg}" />
          <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
        <![endif]-->

        <table class="outer-table" role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background-color:transparent;padding:40px 16px;">
          <tr>
            <td align="center">

              <table class="inner-table" role="presentation" width="560" cellpadding="0" cellspacing="0"
                     style="max-width:560px;width:100%;background-color:transparent;">

                ${headerRow(opts.mascotUrl, opts.logoUrl)}

                ${dividerRow(40)}

                ${opts.contentRows}

                ${dividerRow(32)}

                ${opts.postDividerRows ?? ''}

                ${footerRows(opts.omitFooterDisclaimer)}

              </table>
            </td>
          </tr>
        </table>

        <!--[if gte mso 9]>
          </v:textbox>
        </v:rect>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export const EMAIL_TOKENS = { color: COLOR, font: FONT } as const;
