import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('debt_snowball_plan')
export class DebtSnowballPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt!: Date;

  @Column('text', { name: 'ordered_debt_ids', array: true })
  orderedDebtIds!: string[];

  @Column({ name: 'extra_monthly_payment', type: 'decimal', precision: 19, scale: 4 })
  extraMonthlyPayment!: string;

  @Column({ name: 'lump_sum_payment', type: 'decimal', precision: 19, scale: 4, nullable: true })
  lumpSumPayment!: string | null;

  @Column({ name: 'estimated_completion', type: 'jsonb' })
  estimatedCompletion!: Record<string, unknown>;
}
