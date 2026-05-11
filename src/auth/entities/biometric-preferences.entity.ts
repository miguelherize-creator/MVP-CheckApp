import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('biometric_preferences')
export class BiometricPreferences {
  /** FK a users — también es la PK (relación 1:1). */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  /** 'face_id' | 'fingerprint' | 'device_pin' */
  @Column({ type: 'varchar', length: 30, nullable: true })
  method!: string | null;

  /** Identificador del dispositivo — multi-device es roadmap post-MVP. */
  @Column({ name: 'device_id', type: 'varchar', nullable: true })
  deviceId!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
