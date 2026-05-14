import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

const decimalToNumber = {
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
  to:   (v: number | null) => v,
};

const bigintToNumberNullable = {
  from: (v: string | null) => (v === null ? null : Number(v)),
  to:   (v: number | null) => v,
};

@Entity('user_financial_profile')
export class UserFinancialProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'monthly_income_estimate', type: 'decimal', precision: 19, scale: 4, nullable: true, transformer: decimalToNumber })
  monthlyIncomeEstimate!: number | null;

  @Column({ name: 'stable_expenses_note', type: 'text', nullable: true })
  stableExpensesNote!: string | null;

  @Column({ name: 'estimated_payment_capacity', type: 'decimal', precision: 19, scale: 4, nullable: true, transformer: decimalToNumber })
  estimatedPaymentCapacity!: number | null;

  @Column({ name: 'currency_id', type: 'bigint', nullable: true, transformer: bigintToNumberNullable })
  currencyId!: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
