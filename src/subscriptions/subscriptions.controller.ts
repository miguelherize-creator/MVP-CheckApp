import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SubscriptionsService } from './services/subscriptions.service';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('Suscripciones')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Listar planes disponibles (público)' })
  findPlans() {
    return this.service.findAllPlans();
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Suscripción activa del usuario autenticado' })
  getMySubscription(@CurrentUser() user: JwtPayload) {
    return this.service.findUserSubscription(user.sub);
  }

  @Post('checkout')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Iniciar pago — devuelve la URL de Flow para redirigir al usuario',
  })
  checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    return this.service.checkout(user.sub, user.email, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook de confirmación enviado por Flow (sin JWT)',
  })
  webhook(@Body() body: Record<string, string>) {
    return this.service.handleWebhook(body);
  }

  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Página de retorno tras el pago en Flow (GET)',
  })
  async paymentReturn(@Query('token') token?: string): Promise<string> {
    const data = token ? await this.service.getPaymentReturn(token) : null;
    return this.returnHtml(data);
  }

  @Post('return')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Página de retorno tras el pago en Flow (POST) — Flow redirige con form POST',
  })
  async paymentReturnPost(
    @Body('token') token?: string,
  ): Promise<string> {
    const data = token ? await this.service.getPaymentReturn(token) : null;
    return this.returnHtml(data);
  }

  private returnHtml(data?: {
    flowOrder?: number;
    commerceOrder?: string;
    requestDate?: string;
    status?: number;
    subject?: string;
    currency?: string;
    amount?: number;
    payer?: string;
    paymentData?: Record<string, unknown> | null;
  } | null): string {
    const statusMap: Record<number, { icon: string; title: string; color: string }> = {
      1: { icon: '⏳', title: 'Pago pendiente', color: '#B07D2E' },
      2: { icon: '✅', title: '¡Pago procesado!', color: '#1B6B73' },
      3: { icon: '❌', title: 'Pago rechazado', color: '#C0392B' },
      4: { icon: '🚫', title: 'Pago anulado', color: '#7F8C8D' },
    };

    const s = data?.status != null ? statusMap[data.status] : statusMap[2];
    const { icon, title, color } = s ?? statusMap[2];

    const rows = data
      ? [
          ['Nº Orden Flow', data.flowOrder?.toString() ?? '—'],
          ['Nº Orden comercio', data.commerceOrder ?? '—'],
          ['Fecha y hora', data.requestDate ?? '—'],
          ['Monto', data.amount != null ? `${data.amount.toLocaleString('es-CL')} ${data.currency ?? 'CLP'}` : '—'],
          ['Medio de pago', (data.paymentData as Record<string, string> | null)?.['media'] ?? '—'],
          ['Concepto', data.subject ?? '—'],
          ['Pagador', data.payer ?? '—'],
        ]
      : [];

    const tableRows = rows
      .map(
        ([label, value]) => `
      <tr>
        <td class="label">${label}</td>
        <td class="value">${value}</td>
      </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Walvy — Resultado del pago</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #F7F1E8;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(27,107,115,0.10);
    }
    .icon { font-size: 48px; margin-bottom: 12px; }
    h1 { color: ${color}; font-size: 22px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; text-align: left; }
    tr { border-bottom: 1px solid #F0EAE0; }
    tr:last-child { border-bottom: none; }
    td { padding: 10px 4px; font-size: 14px; }
    .label { color: #5A6B73; font-weight: 500; width: 45%; }
    .value { color: #103F43; font-weight: 600; }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      background: ${color};
      color: #fff;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    ${tableRows ? `<table>${tableRows}</table>` : '<p style="color:#5A6B73;margin-bottom:24px">Tu suscripción se activará en unos segundos.</p>'}
    <a class="btn" href="javascript:window.close()">Cerrar ventana</a>
  </div>
</body>
</html>`;
  }
}
