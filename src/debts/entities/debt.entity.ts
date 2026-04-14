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

@Entity('debts')
export class Debt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'creditor_label', type: 'text', nullable: true })
  creditorLabel!: string | null;

  @Column({ name: 'debt_type', type: 'varchar', length: 30 })
  debtType!: string;

  @Column({ name: 'principal_initial', type: 'decimal', precision: 19, scale: 4, nullable: true })
  principalInitial!: string | null;

  @Column({ name: 'current_balance', type: 'decimal', precision: 19, scale: 4 })
  currentBalance!: string;

  @Column({ type: 'varchar', default: 'CLP' })
  currency!: string;

  @Column({ name: 'apr_annual', type: 'decimal', precision: 19, scale: 4, nullable: true })
  aprAnnual!: string | null;

  @Column({ name: 'minimum_payment', type: 'decimal', precision: 19, scale: 4, nullable: true })
  minimumPayment!: string | null;

  @Column({ name: 'installments_total', type: 'integer', nullable: true })
  installmentsTotal!: number | null;

  @Column({ name: 'installments_remaining', type: 'integer', nullable: true })
  installmentsRemaining!: number | null;

  @Column({ name: 'due_day', type: 'integer', nullable: true })
  dueDay!: number | null;

  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate!: string | null;

  @Column({ name: 'funding_source_id', type: 'uuid', nullable: true })
  fundingSourceId!: string | null;

  @Column({ name: 'snowball_priority', type: 'integer', nullable: true })
  snowballPriority!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
