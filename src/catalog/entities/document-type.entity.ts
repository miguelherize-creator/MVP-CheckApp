import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('document_type')
export class DocumentType {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  documentTypeId!: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'country_id', type: 'bigint', nullable: true })
  countryId!: number | null;

  @Column({ name: 'subject_scope', type: 'varchar', length: 10, default: 'person' })
  subjectScope!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
