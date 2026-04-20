import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  /** Correo electrónico — obligatorio en registro, identificador principal. */
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** RUT chileno normalizado (12345678-9). Opcional pero único si presente. */
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  rut!: string | null;

  /** Handle/alias opcional. Puede usarse como identificador de login. */
  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  username!: string | null;

  @Column({ name: 'password_hash', select: false, type: 'varchar' })
  passwordHash!: string;

  @Column({ name: 'accepted_terms_at', type: 'timestamptz', nullable: true })
  acceptedTermsAt!: Date | null;

  @Column({ name: 'accepted_privacy_at', type: 'timestamptz', nullable: true })
  acceptedPrivacyAt!: Date | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
