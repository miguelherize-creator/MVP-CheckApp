import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('gamification_rules')
export class GamificationRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_type', type: 'varchar', unique: true })
  eventType!: string;

  @Column({ type: 'integer', default: 0 })
  points!: number;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'updated_by_admin_id', type: 'uuid', nullable: true })
  updatedByAdminId!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
