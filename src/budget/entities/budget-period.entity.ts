import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('budget_periods')
export class BudgetPeriod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'integer' })
  year!: number;

  @Column({ type: 'integer' })
  month!: number;

  @Column({ type: 'varchar', default: 'CLP' })
  currency!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
