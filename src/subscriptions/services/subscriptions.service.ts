import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { PaymentOrder } from '../entities/payment-order.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PaymentOrderStatus } from '../enums/payment-order-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { FlowService, FlowPaymentStatus } from './flow.service';
import { CheckoutDto } from '../dto/checkout.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
    @InjectRepository(PaymentOrder)
    private readonly ordersRepo: Repository<PaymentOrder>,
    private readonly flowService: FlowService,
    private readonly config: ConfigService,
  ) {}

  findAllPlans(): Promise<SubscriptionPlan[]> {
    return this.plansRepo.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });
  }

  findUserSubscription(userId: string): Promise<Subscription | null> {
    return this.subsRepo.findOne({ where: { userId } });
  }

  async checkout(
    userId: string,
    userEmail: string,
    dto: CheckoutDto,
  ): Promise<{ paymentUrl: string }> {
    const plan = await this.plansRepo.findOne({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    if (Number(plan.price) === 0)
      throw new BadRequestException('El plan gratuito no requiere pago');

    const commerceOrder = `WALVY-${crypto.randomUUID()}`;
    const confirmUrl = this.config.getOrThrow<string>('FLOW_CONFIRM_URL');
    const returnUrl = this.config.getOrThrow<string>('FLOW_RETURN_URL');

    const result = await this.flowService.createPayment({
      commerceOrder,
      subject: `Suscripción Walvy — ${plan.name}`,
      amount: Number(plan.price),
      email: userEmail,
      urlConfirmation: confirmUrl,
      urlReturn: returnUrl,
    });

    await this.ordersRepo.save(
      this.ordersRepo.create({
        userId,
        planId: plan.id,
        amount: plan.price,
        currency: plan.currency,
        provider: PaymentProvider.flow,
        status: PaymentOrderStatus.pending,
        commerceOrder,
        flowToken: result.token,
        flowOrder: String(result.flowOrder),
        subscriptionId: null,
        providerResponse: null,
      }),
    );

    return { paymentUrl: `${result.url}?token=${result.token}` };
  }

  async getPaymentReturn(token: string): Promise<FlowPaymentStatus | null> {
    if (!token) return null;
    try {
      return await this.flowService.getPaymentStatus(token);
    } catch {
      return null;
    }
  }

  // Llamado por el webhook de Flow — no lanza excepciones para no afectar el ACK
  async handleWebhook(body: Record<string, string>): Promise<void> {
    if (!this.flowService.verifyWebhookSignature(body)) return;

    const { token } = body;
    if (!token) return;

    const order = await this.ordersRepo.findOne({
      where: { flowToken: token },
    });
    if (!order || order.status !== PaymentOrderStatus.pending) return;

    const flowStatus = await this.flowService.getPaymentStatus(token);
    order.providerResponse = flowStatus as unknown as Record<string, unknown>;

    // Flow status: 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
    if (flowStatus.status === 2) {
      order.status = PaymentOrderStatus.paid;
      await this.ordersRepo.save(order);
      await this.activateSubscription(order.userId, order.planId, order.id);
    } else if (flowStatus.status === 3) {
      order.status = PaymentOrderStatus.rejected;
      await this.ordersRepo.save(order);
    } else if (flowStatus.status === 4) {
      order.status = PaymentOrderStatus.cancelled;
      await this.ordersRepo.save(order);
    }
  }

  private async activateSubscription(
    userId: string,
    planId: string,
    orderId: string,
  ): Promise<void> {
    const plan = await this.plansRepo.findOneOrFail({ where: { id: planId } });
    const now = new Date();
    const periodEnd = plan.billingIntervalDays
      ? new Date(now.getTime() + plan.billingIntervalDays * 86_400_000)
      : null;

    let sub = await this.subsRepo.findOne({ where: { userId } });
    if (sub) {
      sub.planId = planId;
      sub.status = SubscriptionStatus.active;
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = periodEnd;
      sub.cancelledAt = null;
    } else {
      sub = this.subsRepo.create({
        userId,
        planId,
        status: SubscriptionStatus.active,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      });
    }

    const saved = await this.subsRepo.save(sub);
    await this.ordersRepo.update(orderId, { subscriptionId: saved.id });
  }
}
