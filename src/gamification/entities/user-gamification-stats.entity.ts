import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_gamification_stats')
export class UserGamificationStats {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'total_points', type: 'integer', default: 0 })
  totalPoints!: number;

  @Column({ type: 'integer', default: 1 })
  level!: number;

  @Column({ name: 'last_computed_at', type: 'timestamptz' })
  lastComputedAt!: Date;
}
