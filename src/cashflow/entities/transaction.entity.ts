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
import { CategorizationStatus } from '../enums/categorization-status.enum';
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

  /** Cuenta/instrumento de origen del movimiento (de dónde sale el dinero). */
  @Column({ name: 'funding_source_id', type: 'uuid', nullable: true })
  fundingSourceId: string | null;

  @ManyToOne(() => FundingSource, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'funding_source_id' })
  fundingSource: FundingSource | null;

  /**
   * Cuenta/instrumento de destino del movimiento (adónde va el dinero).
   * Se usa en transferencias entre cuentas propias y en pagos a TC o créditos.
   * NULL en transacciones simples de consumo.
   * Cuando fundingSourceId y destinationFundingSourceId pertenecen al mismo usuario
   * → traspaso interno → se excluye de métricas de gasto real.
   */
  @Column({ name: 'destination_funding_source_id', type: 'uuid', nullable: true })
  destinationFundingSourceId: string | null;

  @ManyToOne(() => FundingSource, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'destination_funding_source_id' })
  destinationFundingSource: FundingSource | null;

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

  /**
   * Glosa original tal como viene del banco o cartola. Inmutable post-importación.
   * Es el insumo principal para auto-categorización y detección de recurrencia.
   * NULL en transacciones ingresadas manualmente por el usuario.
   */
  @Column({ name: 'bank_description', type: 'text', nullable: true })
  bankDescription: string | null;

  /** Descripción legible para el usuario. Puede ser editada. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Estado de categorización del movimiento.
   * - categorized: clasificado correctamente, no requiere acción.
   * - pending_review: importado con baja confianza, el usuario debe revisar.
   * - uncategorized: creado manualmente sin categoría asignada.
   */
  @Column({
    name: 'categorization_status',
    type: 'varchar',
    length: 20,
    default: CategorizationStatus.CATEGORIZED,
  })
  categorizationStatus: CategorizationStatus;

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
