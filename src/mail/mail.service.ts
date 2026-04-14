import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');

    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
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

  private get from(): string {
    return this.config.get<string>('MAIL_FROM', 'Walvy <no-reply@walvy.app>');
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[MAIL-LOG] To: ${to} | Subject: ${subject} | Body: ${html}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP error enviando a ${to}: ${message}`);
    }
  }

  async sendEmailVerificationCode(to: string, code: string): Promise<void> {
    const subject = 'Tu código de verificación Walvy';
    const html = `
      <p>Hola,</p>
      <p>Tu código de verificación es:</p>
      <h2 style="letter-spacing:8px">${code}</h2>
      <p>Válido por 15 minutos. Si no solicitaste esto, ignora este mensaje.</p>
    `;
    await this.send(to, subject, html);
    this.logger.log(`Código de verificación enviado a ${to}`);
  }

  async sendPasswordResetEmail(to: string, plainToken: string): Promise<void> {
    const template = this.config.get<string>('PASSWORD_RESET_URL_TEMPLATE', '');
    const url = template.includes('{{token}}')
      ? template.replace('{{token}}', encodeURIComponent(plainToken))
      : `${template}${template.includes('?') ? '&' : '?'}token=${encodeURIComponent(plainToken)}`;

    const subject = 'Restablecer contraseña Walvy';
    const html = `
      <p>Hola,</p>
      <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
      <p><a href="${url}">${url}</a></p>
      <p>El enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
    `;
    await this.send(to, subject, html);
    this.logger.log(`Email de recuperación enviado a ${to}`);
  }
}
