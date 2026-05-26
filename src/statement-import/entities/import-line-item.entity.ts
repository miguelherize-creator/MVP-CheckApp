import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ImportLineReviewStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EDITED = 'edited',
}

@Entity('import_line_items')
export class ImportLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'import_id', type: 'uuid' })
  importId!: string;

  @Column({ name: 'row_index', type: 'int' })
  rowIndex!: number;

  @Column({ name: 'raw_row', type: 'jsonb' })
  rawRow!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  normalized!: Record<string, any> | null;

  @Column({
    name: 'user_review_status',
    type: 'enum',
    enum: ImportLineReviewStatus,
    default: ImportLineReviewStatus.PENDING,
  })
  userReviewStatus!: ImportLineReviewStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
