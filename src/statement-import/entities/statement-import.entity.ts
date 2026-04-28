import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PARSED = 'parsed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('statement_imports')
export class StatementImport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'file_key', type: 'text' })
  fileKey!: string;

  @Column({ name: 'original_filename', type: 'text' })
  originalFilename!: string;

  @Column({
    type: 'enum',
    enum: ImportStatus,
    default: ImportStatus.PENDING,
  })
  status!: ImportStatus;

  @Column({ name: 'parsed_at', type: 'timestamptz', nullable: true })
  parsedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
