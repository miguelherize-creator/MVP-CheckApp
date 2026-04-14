import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('gamification_events')
export class GamificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ type: 'integer' })
  points!: number;

  @Column({ name: 'reference_type', type: 'text', nullable: true })
  referenceType!: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
