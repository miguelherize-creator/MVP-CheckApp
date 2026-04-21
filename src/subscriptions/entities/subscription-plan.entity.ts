import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 10, default: 'CLP' })
  currency: string;

  @Column({ name: 'billing_interval_days', type: 'int', nullable: true })
  billingIntervalDays: number | null;

  @Column({ type: 'jsonb', default: [] })
  features: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
