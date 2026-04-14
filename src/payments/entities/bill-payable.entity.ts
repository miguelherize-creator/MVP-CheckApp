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

@Entity('bills_payable')
export class BillPayable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ name: 'funding_source_id', type: 'uuid', nullable: true })
  fundingSourceId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring!: boolean;

  @Column({ name: 'recurrence_interval_days', type: 'integer', nullable: true })
  recurrenceIntervalDays!: number | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'linked_transaction_id', type: 'uuid', nullable: true })
  linkedTransactionId!: string | null;

  @Column({ name: 'traffic_light_state', type: 'varchar', length: 10, nullable: true })
  trafficLightState!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
