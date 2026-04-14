import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';

@Entity('ai_context_snapshots')
export class AiContextSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => AiConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AiConversation;

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate!: string;

  @Column({ name: 'financial_summary', type: 'jsonb' })
  financialSummary!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
