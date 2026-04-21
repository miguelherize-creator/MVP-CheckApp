import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';

const DEFAULT_PLANS = [
  {
    name: 'Free',
    slug: 'free',
    price: 0,
    currency: 'CLP',
    billingIntervalDays: null as number | null,
    features: [
      'Registro de transacciones',
      'Categorías predefinidas',
      'Balance mensual',
      'Importación de cartola (3/mes)',
    ],
    isActive: true,
  },
  {
    name: 'Pro',
    slug: 'pro_monthly',
    price: 4990,
    currency: 'CLP',
    billingIntervalDays: 30,
    features: [
      'Todo lo del plan Free',
      'Importaciones ilimitadas',
      'Asistente financiero IA',
      'Motor de deudas (Bola de Nieve)',
      'Presupuesto avanzado',
      'Informes detallados',
    ],
    isActive: true,
  },
];

@Injectable()
export class SubscriptionSeedService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionSeedService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const plan of DEFAULT_PLANS) {
      const exists = await this.plansRepo.findOne({
        where: { slug: plan.slug },
      });
      if (exists) continue;

      await this.plansRepo.save(this.plansRepo.create(plan));
      this.logger.log(`Plan creado: ${plan.name} (${plan.slug})`);
    }
  }
}
