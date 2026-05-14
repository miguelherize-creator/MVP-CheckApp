import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';

@Injectable()
export class SubscriptionSeedService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionSeedService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const monthlyPrice = this.config.get<number>('PLAN_PRO_MONTHLY_PRICE', 5000);
    const annualPrice  = this.config.get<number>('PLAN_PRO_ANNUAL_PRICE',  50000);

    const plans = [
      {
        slug: 'pro_monthly',
        name: 'Pro Mensual',
        price: Number(monthlyPrice),
        currency: 'CLP',
        billingIntervalDays: 30,
        features: [
          'Registro y categorización de transacciones',
          'Importación de cartolas',
          'Diagnóstico financiero',
          'Motor de deudas (Bola de Nieve)',
          'Presupuesto avanzado',
          'Asistente financiero IA',
        ],
        isActive: true,
      },
      {
        slug: 'pro_annual',
        name: 'Pro Anual',
        price: Number(annualPrice),
        currency: 'CLP',
        billingIntervalDays: 365,
        features: [
          'Todo lo del plan Pro Mensual',
          `Ahorra ${((Number(monthlyPrice) * 12) - Number(annualPrice)).toLocaleString('es-CL')} CLP al año`,
        ],
        isActive: true,
      },
    ];

    for (const plan of plans) {
      const existing = await this.plansRepo.findOne({ where: { slug: plan.slug } });

      if (existing) {
        const priceChanged = Number(existing.price) !== plan.price;
        if (priceChanged) {
          await this.plansRepo.update({ slug: plan.slug }, { price: plan.price, features: plan.features });
          this.logger.log(`Plan actualizado: ${plan.name} → ${plan.price} ${plan.currency}`);
        }
        continue;
      }

      await this.plansRepo.save(this.plansRepo.create(plan));
      this.logger.log(`Plan creado: ${plan.name} (${plan.slug}) — ${plan.price} ${plan.currency}`);
    }
  }
}
