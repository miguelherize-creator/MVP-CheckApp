import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BudgetPeriod } from './budget-period.entity';

@Entity('budget_lines')
export class BudgetLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'budget_period_id', type: 'uuid' })
  budgetPeriodId!: string;

  @ManyToOne(() => BudgetPeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_period_id' })
  budgetPeriod!: BudgetPeriod;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ name: 'subcategory_id', type: 'uuid', nullable: true })
  subcategoryId!: string | null;

  @Column({ name: 'planned_amount', type: 'decimal', precision: 19, scale: 4 })
  plannedAmount!: string;

  @Column({ name: 'planned_min', type: 'decimal', precision: 19, scale: 4, nullable: true })
  plannedMin!: string | null;

  @Column({ name: 'planned_max', type: 'decimal', precision: 19, scale: 4, nullable: true })
  plannedMax!: string | null;

  @Column({ name: 'suggested_by_app', type: 'boolean', default: false })
  suggestedByApp!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
