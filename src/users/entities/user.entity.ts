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

  @Column({ type: 'varchar', nullable: true })
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