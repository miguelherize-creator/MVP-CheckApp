import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatementImport } from './statement-import.entity';

@Entity('import_line_items')
export class ImportLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'import_id', type: 'uuid' })
  importId!: string;

  @ManyToOne(() => StatementImport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_id' })
  import!: StatementImport;

  @Column({ name: 'row_index', type: 'integer', nullable: true })
  rowIndex!: number | null;

  @Column({ name: 'raw_row', type: 'jsonb', nullable: true })
  rawRow!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  normalized!: Record<string, unknown> | null;

  @Column({ name: 'user_review_status', type: 'varchar', length: 20, default: 'pending' })
  userReviewStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
