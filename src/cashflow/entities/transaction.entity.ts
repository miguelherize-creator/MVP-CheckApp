import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FlowType } from '../enums/flow-type.enum';
import { MovementType } from '../enums/movement-type.enum';
import { Category } from './category.entity';
import { FundingSource } from './funding-source.entity';
import { Subcategory } from './subcategory.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'movement_type', type: 'varchar', length: 16 })
  movementType: MovementType;

  @Column({ name: 'flow_type', type: 'varchar', length: 16 })
  flowType: FlowType;

  @Column({ name: 'funding_source_id', type: 'uuid', nullable: true })
  fundingSourceId: string | null;

  @ManyToOne(() => FundingSource, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'funding_source_id' })
  fundingSource: FundingSource | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'subcategory_id', type: 'uuid', nullable: true })
  subcategoryId: string | null;

  @ManyToOne(() => Subcategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: Subcategory | null;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: string;

  @Column({ name: 'occurred_on', type: 'date' })
  occurredOn: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_ant_expense', default: false })
  isAntExpense: boolean;

  @Column({ name: 'external_ref', type: 'text', nullable: true })
  externalRef: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
