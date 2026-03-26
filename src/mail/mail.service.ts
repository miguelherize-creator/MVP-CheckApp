import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    const url = template.includes('{{token}}')
      ? template.replace('{{token}}', encodeURIComponent(plainToken))
      : `${template}${template.includes('?') ? '&' : '?'}token=${encodeURIComponent(plainToken)}`;

    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'development') {
      this.logger.log(
        `[DEV] Password reset for ${to}: ${url}`,
      );
      return;
    }

    // Producción: integrar SMTP/SendGrid aquí usando variables SMTP_*
    this.logger.warn(
      `Mail adapter no configurado para producción; link para ${to}: ${url}`,
    );
  }
}
