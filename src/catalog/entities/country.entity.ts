import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('country')
export class Country {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  countryId!: number;

  @Column({ name: 'country_code', type: 'char', length: 2, unique: true })
  countryCode!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
