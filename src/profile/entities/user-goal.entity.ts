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

@Entity('user_goals')
export class UserGoal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'goal_type', type: 'varchar', length: 40 })
  goalType!: string;

  @Column({ name: 'target_value', type: 'decimal', precision: 19, scale: 4, nullable: true, transformer: { from: (v: string | null) => v === null ? null : parseFloat(v), to: (v: number | null) => v } })
  targetValue!: number | null;

  @Column({ name: 'declared_at', type: 'timestamptz' })
  declaredAt!: Date;

  @Column({ name: 'progress_cache', type: 'jsonb', nullable: true })
  progressCache!: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
