import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_financial_profile')
export class UserFinancialProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'monthly_income_estimate', type: 'decimal', precision: 19, scale: 4, nullable: true })
  monthlyIncomeEstimate!: string | null;

  @Column({ name: 'stable_expenses_note', type: 'text', nullable: true })
  stableExpensesNote!: string | null;

  @Column({ name: 'estimated_payment_capacity', type: 'decimal', precision: 19, scale: 4, nullable: true })
  estimatedPaymentCapacity!: string | null;

  @Column({ type: 'varchar', default: 'CLP' })
  currency!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
