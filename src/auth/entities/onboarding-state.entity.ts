import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Seguimiento del progreso del onboarding — relación 1:1 con users.
 * Se crea al registrar la cuenta y se avanza paso a paso.
 *
 * Pasos posibles de current_step:
 *   'email_verification'  → Flow A: enviando código al email registrado
 *   'email_collection'    → Flow B: esperando que el usuario ingrese su correo
 *   'profile'             → Email verificado, completando perfil financiero (M2)
 *   'goals'               → Perfil listo, definiendo metas (M2)
 *   'completed'           → Onboarding terminado
 */
@Entity('onboarding_state')
export class OnboardingState {
  /** FK a users — también es la PK (relación 1:1). */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'current_step', type: 'varchar', length: 50, default: 'email_verification' })
  currentStep!: string;

  @Column({ name: 'financial_profile_completed', type: 'boolean', default: false })
  financialProfileCompleted!: boolean;

  @Column({ name: 'goals_set', type: 'boolean', default: false })
  goalsSet!: boolean;

  @Column({ name: 'import_attempted', type: 'boolean', default: false })
  importAttempted!: boolean;

  @Column({ name: 'biometric_prompted', type: 'boolean', default: false })
  biometricPrompted!: boolean;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
