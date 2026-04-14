import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_config')
export class AppConfig {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'updated_by_admin_id', type: 'uuid', nullable: true })
  updatedByAdminId!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
