import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_financial_profile')
export class UserFinancialProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'monthly_income_estimate',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  monthlyIncomeEstimate!: number | null;

  @Column({
    name: 'stable_expenses_note',
    type: 'text',
    nullable: true,
  })
  stableExpensesNote!: string | null;

  @Column({
    name: 'estimated_payment_capacity',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  estimatedPaymentCapacity!: number | null;

  @Column({
    type: 'text',
    nullable: true,
    default: 'CLP',
  })
  currency!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
