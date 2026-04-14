import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiMessage } from './ai-message.entity';

@Entity('ai_tool_invocations')
export class AiToolInvocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => AiMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message!: AiMessage;

  @Column({ name: 'tool_name', type: 'text' })
  toolName!: string;

  @Column({ type: 'jsonb', nullable: true })
  args!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
