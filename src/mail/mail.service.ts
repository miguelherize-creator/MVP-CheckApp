import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { emailVerificationHtml } from './templates/email-verification.template';
import { passwordResetOtpHtml } from './templates/password-reset-otp.template';

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

  async sendEmailVerificationCode(to: string, code: string): Promise<void> {
    const expiresMinutes = this.config.get<number>('EMAIL_VERIFICATION_EXPIRES_MINUTES', 15);
    const subject        = 'Confirma tu cuenta en Walvy';

    const html = emailVerificationHtml({
      code,
      expiresMinutes,
      mascotUrl:  this.mascotUrl,
      logoUrl:    this.logoUrl,
      isotypeUrl: this.isotypeUrl,
    });

    await this.send(to, subject, html);
    this.logger.log(`Código de verificación enviado a ${to}`);
  }

  async sendPasswordResetOtp(to: string, code: string): Promise<void> {
    const expiresMinutes = this.config.get<number>('PASSWORD_RESET_EXPIRES_MINUTES', 15);

    const html = passwordResetOtpHtml({
      code,
      expiresMinutes,
      mascotUrl:  this.mascotUrl,
      logoUrl:    this.logoUrl,
      isotypeUrl: this.isotypeUrl,
    });

    await this.send(to, 'Restablece tu contraseña en Walvy', html);
    this.logger.log(`Código OTP de recuperación enviado a ${to}`);
  }
}
