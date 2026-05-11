import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_onboarding_state')
export class OnboardingState {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'onboarding_status',
    type: 'varchar',
    length: 20,
    default: 'not_started',
  })
  onboardingStatus!: string;

  @Column({ name: 'current_step', type: 'varchar', length: 80, nullable: true })
  currentStep!: string | null;

  @Column({ name: 'resume_surface', type: 'varchar', length: 80, nullable: true })
  resumeSurface!: string | null;

  @Column({ name: 'resume_context', type: 'jsonb', nullable: true })
  resumeContext!: Record<string, unknown> | null;

  @Column({ name: 'financial_profile_completed', type: 'boolean', default: false })
  financialProfileCompleted!: boolean;

  @Column({ name: 'goals_set', type: 'boolean', default: false })
  goalsSet!: boolean;

  @Column({ name: 'import_attempted', type: 'boolean', default: false })
  importAttempted!: boolean;

  @Column({ name: 'biometric_prompted', type: 'boolean', default: false })
  biometricPrompted!: boolean;

  @Column({ name: 'min_doc_threshold_met', type: 'boolean', default: false })
  minDocThresholdMet!: boolean;

  @Column({ name: 'last_checkpoint_at', type: 'timestamptz', default: () => 'now()' })
  lastCheckpointAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
