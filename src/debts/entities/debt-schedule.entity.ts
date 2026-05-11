import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Debt } from './debt.entity';

@Entity('debt_schedules')
export class DebtSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'debt_id', type: 'uuid' })
  debtId!: string;

  @ManyToOne(() => Debt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt!: Debt;

  @Column({ name: 'installment_no', type: 'integer' })
  installmentNo!: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'planned_principal', type: 'decimal', precision: 19, scale: 4, nullable: true })
  plannedPrincipal!: string | null;

  @Column({ name: 'planned_interest', type: 'decimal', precision: 19, scale: 4, nullable: true })
  plannedInterest!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
