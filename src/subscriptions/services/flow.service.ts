import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

export interface FlowCreatePaymentParams {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
}

export interface FlowCreatePaymentResult {
  token: string;
  url: string;
  flowOrder: number;
}

export interface FlowPaymentStatus {
  flowOrder: number;
  commerceOrder: string;
  requestDate: string;
  status: number; // 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
  subject: string;
  currency: string;
  amount: number;
  payer: string;
  paymentData: Record<string, unknown> | null;
}

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = config.get<string>('FLOW_API_URL', 'https://sandbox.flow.cl/api');
    this.apiKey = config.getOrThrow<string>('FLOW_API_KEY');
    this.secretKey = config.getOrThrow<string>('FLOW_SECRET_KEY');

    this.logger.debug(`apiUrl  : ${this.apiUrl}`);
    this.logger.debug(`apiKey  : "${this.apiKey}" (len=${this.apiKey.length})`);
    this.logger.debug(`secretKey len=${this.secretKey.length}`);
  }

  private sign(params: Record<string, string | number>): string {
    const concatenated = Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join('');
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(concatenated)
      .digest('hex');
  }

  private withSignature(
    params: Record<string, string | number>,
  ): Record<string, string | number> {
    const full = { ...params, apiKey: this.apiKey };
    return { ...full, s: this.sign(full) };
  }

  async createPayment(
    p: FlowCreatePaymentParams,
  ): Promise<FlowCreatePaymentResult> {
    const params = this.withSignature({
      commerceOrder: p.commerceOrder,
      subject: p.subject,
      currency: 'CLP',
      amount: p.amount,
      email: p.email,
      urlConfirmation: p.urlConfirmation,
      urlReturn: p.urlReturn,
    });

    try {
      const res = await fetch(`${this.apiUrl}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(
          params as Record<string, string>,
        ).toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Flow createPayment HTTP ${res.status}: ${text}`);
        throw new Error(text);
      }

      const data = (await res.json()) as FlowCreatePaymentResult;
      return data;
    } catch (err) {
      this.logger.error('Flow createPayment failed', err);
      throw new InternalServerErrorException(
        'Error al crear la orden de pago en Flow',
      );
    }
  }

  async getPaymentStatus(token: string): Promise<FlowPaymentStatus> {
    const params = this.withSignature({ token });
    const qs = new URLSearchParams(
      params as Record<string, string>,
    ).toString();

    try {
      const res = await fetch(`${this.apiUrl}/payment/getStatus?${qs}`);

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Flow getPaymentStatus HTTP ${res.status}: ${text}`);
        throw new Error(text);
      }

      return (await res.json()) as FlowPaymentStatus;
    } catch (err) {
      this.logger.error('Flow getPaymentStatus failed', err);
      throw new InternalServerErrorException(
        'Error al consultar el estado de pago en Flow',
      );
    }
  }

  verifyWebhookSignature(body: Record<string, string>): boolean {
    const { s, ...rest } = body;
    if (!s) return false;

    const expected = this.sign(rest);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(s, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
