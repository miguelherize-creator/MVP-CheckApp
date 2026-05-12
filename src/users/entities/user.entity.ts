import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

const bigintToNumber = {
  to: (v: number) => v,
  from: (v: string) => Number(v),
};

const bigintToNumberNullable = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v !== null && v !== undefined ? Number(v) : null),
};

@Entity('app_user')
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 320, nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ name: 'auth_provider', type: 'varchar', length: 50, nullable: true })
  authProvider!: string | null;

  @Column({ name: 'auth_provider_user_id', type: 'varchar', length: 200, nullable: true })
  authProviderUserId!: string | null;

  @Column({ name: 'identifier_type', type: 'varchar', length: 20, default: 'email' })
  identifierType!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 200, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  username!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'notification_email', type: 'varchar', length: 320, nullable: true })
  notificationEmail!: string | null;

  @Column({ name: 'notification_email_verified_at', type: 'timestamptz', nullable: true })
  notificationEmailVerifiedAt!: Date | null;

  @Column({ name: 'document_type_id', type: 'bigint', nullable: true, transformer: bigintToNumberNullable })
  documentTypeId!: number | null;

  @Column({ name: 'document_number', type: 'varchar', length: 50, nullable: true })
  documentNumber!: string | null;

  @Column({ name: 'country_id', type: 'bigint', transformer: bigintToNumber })
  countryId!: number;

  @Column({ name: 'default_currency_id', type: 'bigint', transformer: bigintToNumber })
  defaultCurrencyId!: number;

  @Column({ name: 'role_id', type: 'bigint', transformer: bigintToNumber })
  roleId!: number;

  @Column({ name: 'user_status_id', type: 'bigint', transformer: bigintToNumber })
  userStatusId!: number;

  @Column({ name: 'trial_started_at', type: 'timestamptz', nullable: true })
  trialStartedAt!: Date | null;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt!: Date | null;

  @Column({ name: 'current_financial_health_level_id', type: 'bigint', nullable: true, transformer: bigintToNumberNullable })
  currentFinancialHealthLevelId!: number | null;

  @Column({ name: 'financial_health_updated_at', type: 'timestamptz', nullable: true })
  financialHealthUpdatedAt!: Date | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'accepted_terms_at', type: 'timestamptz', nullable: true })
  acceptedTermsAt!: Date | null;

  @Column({ name: 'accepted_privacy_at', type: 'timestamptz', nullable: true })
  acceptedPrivacyAt!: Date | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
