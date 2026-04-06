import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { buildResetPasswordTemplate } from './templates/reset-password.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Envía (o en desarrollo: registra) el enlace de recuperación de contraseña.
   * `PASSWORD_RESET_URL_TEMPLATE` debe incluir `{{token}}` donde va el token en claro.
   */
async sendPasswordResetEmail(to: string, plainToken: string): Promise<void> {
  const template = this.config.get<string>('PASSWORD_RESET_URL_TEMPLATE', '');
  const expiresMinutes = this.config.get<number>('PASSWORD_RESET_EXPIRES_MINUTES', 60);

  const resetUrl = template.includes('{{token}}')
    ? template.replace('{{token}}', encodeURIComponent(plainToken))
    : `${template}${template.includes('?') ? '&' : '?'}token=${encodeURIComponent(plainToken)}`;

  const nodeEnv = this.config.get<string>('NODE_ENV', 'development');

  // En desarrollo: solo log, no SMTP real
  if (nodeEnv === 'development') {
    this.logger.log(`[DEV] Password reset for ${to}: ${resetUrl}`);
    return;
  }

  const host = this.config.get<string>('SMTP_HOST');
  const port = this.config.get<number>('SMTP_PORT', 587);
  const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';
  const user = this.config.get<string>('SMTP_USER');
  const pass = this.config.get<string>('SMTP_PASS');
  const from = this.config.get<string>('MAIL_FROM', 'Walvy <no-reply@walvy.app>');

  if (!host || !user || !pass) {
    this.logger.warn(`SMTP no configurado. Link para ${to}: ${resetUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const { subject, html, text } = buildResetPasswordTemplate(
    resetUrl,
    expiresMinutes,
  );

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  this.logger.log(`Password reset email sent to ${to}`);
}
}
