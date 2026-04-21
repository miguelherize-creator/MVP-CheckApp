import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentOrderStatus } from '../enums/payment-order-status.enum';

@Entity('payment_orders')
export class PaymentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @ManyToOne(() => Subscription, { nullable: true })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription | null;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'CLP' })
  currency: string;

  @Column({ type: 'varchar', length: 32 })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 32 })
  status: PaymentOrderStatus;

  // Referencia interna enviada a Flow — inmutable, usada para idempotencia
  @Column({ name: 'commerce_order', type: 'varchar', length: 100, unique: true })
  commerceOrder: string;

  @Column({ name: 'flow_token', type: 'varchar', length: 100, nullable: true, unique: true })
  flowToken: string | null;

  @Column({ name: 'flow_order', type: 'varchar', length: 100, nullable: true })
  flowOrder: string | null;

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
