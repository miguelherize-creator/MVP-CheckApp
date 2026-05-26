import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('currency')
export class Currency {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  currencyId!: number;

  @Column({ name: 'currency_code', type: 'char', length: 3, unique: true })
  currencyCode!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'minor_units', type: 'smallint', default: 0 })
  minorUnits!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
