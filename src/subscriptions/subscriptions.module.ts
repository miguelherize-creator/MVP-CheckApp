import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { Subscription } from './entities/subscription.entity';
import { PaymentOrder } from './entities/payment-order.entity';
import { SubscriptionsService } from './services/subscriptions.service';
import { SubscriptionSeedService } from './services/subscription-seed.service';
import { FlowService } from './services/flow.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPlan, Subscription, PaymentOrder]),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionSeedService, FlowService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
