import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('movement_classification_suggestions')
export class MovementClassificationSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId!: string | null;

  @Column({ name: 'import_line_id', type: 'uuid', nullable: true })
  importLineId!: string | null;

  @Column({ name: 'suggested_target', type: 'varchar', length: 30 })
  suggestedTarget!: string;

  @Column({ type: 'decimal', precision: 19, scale: 4, nullable: true })
  confidence!: string | null;

  @Column({ name: 'rule_matched', type: 'text', nullable: true })
  ruleMatched!: string | null;

  @Column({ name: 'user_decision', type: 'varchar', length: 20, nullable: true })
  userDecision!: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
