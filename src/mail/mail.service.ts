import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { emailVerificationHtml } from './templates/email-verification.template';
import { passwordResetHtml } from './templates/password-reset.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const isDev = this.config.get<string>('NODE_ENV', 'development') === 'development';
    const host  = this.config.get<string>('SMTP_HOST');
    const user  = this.config.get<string>('SMTP_USER');

    if (isDev) {
      this.logger.warn('NODE_ENV=development — emails solo se logearán en consola (SMTP desactivado).');
    } else if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port:   this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
        auth: {
          user,
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    } else {
      this.logger.warn('SMTP no configurado — los emails solo se logearán en consola.');
    }
  }

  // ─── Imágenes del email — configurar en .env ────────────────────────────────
  private get mascotUrl(): string {
    return this.config.get<string>('MAIL_MASCOT_URL', 'https://walvy.app/assets/mascot-email.png');
  }

  private get logoUrl(): string {
    return this.config.get<string>('MAIL_LOGO_URL', 'https://walvy.app/assets/walvy-logo-horizontal.png');
  }

  /** Isotipo (símbolo Walvy) usado como watermark blureado en el fondo del correo. */
  private get isotypeUrl(): string {
    return this.config.get<string>('MAIL_ISOTYPE_URL', this.logoUrl);
  }

  private get from(): string {
    return this.config.get<string>('MAIL_FROM', 'Walvy <no-reply@walvy.app>');
  }

  // ─── Envío interno ──────────────────────────────────────────────────────────
  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[MAIL-LOG] To: ${to} | Subject: ${subject}\n${html}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP error enviando a ${to}: ${message}`);
      throw err;
    }
  }

  // ─── Verificación de email (magic link) ────────────────────────────────────
  async sendEmailVerificationLink(
    to: string,
    firstName: string,
    lastName: string,
    verifyUrl: string,
  ): Promise<void> {
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'usuario';
    const subject  = `${firstName || 'Hola'}, confirma tu cuenta en Walvy`;

    const html = emailVerificationHtml({
      fullName,
      verifyUrl,
      mascotUrl:  this.mascotUrl,
      logoUrl:    this.logoUrl,
      isotypeUrl: this.isotypeUrl,
    });

    await this.send(to, subject, html);
    this.logger.log(`Enlace de verificación enviado a ${to}`);
  }

  // ─── Recuperación de contraseña ─────────────────────────────────────────────
  async sendPasswordResetEmail(to: string, plainToken: string): Promise<void> {
    const template        = this.config.get<string>('PASSWORD_RESET_URL_TEMPLATE', '');
    const expiresMinutes  = this.config.get<number>('PASSWORD_RESET_EXPIRES_MINUTES', 60);

    const resetUrl = template.includes('{{token}}')
      ? template.replace('{{token}}', encodeURIComponent(plainToken))
      : `${template}${template.includes('?') ? '&' : '?'}token=${encodeURIComponent(plainToken)}`;

    const html = passwordResetHtml({
      resetUrl,
      expiresMinutes,
      mascotUrl:  this.mascotUrl,
      logoUrl:    this.logoUrl,
      isotypeUrl: this.isotypeUrl,
    });

    await this.send(to, 'Recupera tu contraseña en Walvy', html);
    this.logger.log(`Email de recuperación enviado a ${to}`);
  }
}
