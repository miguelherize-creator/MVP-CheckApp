import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('financial_health_level')
export class FinancialHealthLevel {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  financialHealthLevelId!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ name: 'name_es', type: 'varchar', length: 120 })
  nameEs!: string;

  @Column({ name: 'description_es', type: 'text', nullable: true })
  descriptionEs!: string | null;

  @Column({ name: 'asset_path', type: 'varchar', length: 500, nullable: true })
  assetPath!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
