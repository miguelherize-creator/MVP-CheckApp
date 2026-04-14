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

  @Column({ unique: true, length: 100, type: 'varchar' })
  username!: string;

  /**
   * Cómo se registró el usuario: 'email' | 'rut' | 'username'.
   * Determina qué normalizó el backend al almacenar `username`.
   * Default 'email' para compatibilidad con registros anteriores al MVP.
   */
  @Column({ name: 'identifier_type', type: 'varchar', length: 20, default: 'email' })
  identifierType!: 'email' | 'rut' | 'username';

  @Column({ type: 'varchar', nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'password_hash', select: false, type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ name: 'accepted_terms_at', type: 'timestamptz', nullable: true })
  acceptedTermsAt!: Date | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}