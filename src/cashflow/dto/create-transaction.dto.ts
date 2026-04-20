import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CategorizationStatus } from '../enums/categorization-status.enum';
import { FlowType } from '../enums/flow-type.enum';
import { MovementType } from '../enums/movement-type.enum';

export class CreateTransactionDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({ enum: FlowType })
  @IsEnum(FlowType)
  flowType: FlowType;

  @ApiPropertyOptional({ description: 'Cuenta de origen del movimiento' })
  @IsOptional()
  @IsUUID()
  fundingSourceId?: string;

  @ApiPropertyOptional({
    description:
      'Cuenta de destino del movimiento. Requerido en transferencias entre cuentas propias ' +
      'y pagos a tarjeta de crédito o línea de crédito.',
  })
  @IsOptional()
  @IsUUID()
  destinationFundingSourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount: number;

  @ApiProperty({ example: '2026-03-30' })
  @IsDateString()
  occurredOn: string;

  @ApiPropertyOptional({
    description:
      'Glosa original del banco (inmutable). Solo se envía en importaciones desde cartola.',
    example: 'PAGO:SPID SAN DAMIAN',
  })
  @IsOptional()
  @IsString()
  bankDescription?: string;

  @ApiPropertyOptional({
    description: 'Descripción legible para el usuario. Puede editarse.',
    example: 'Café San Damián',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: CategorizationStatus,
    default: CategorizationStatus.CATEGORIZED,
    description:
      'Estado de categorización. El pipeline de cartolas usa pending_review para ' +
      'movimientos con baja confianza de categorización.',
  })
  @IsOptional()
  @IsEnum(CategorizationStatus)
  categorizationStatus?: CategorizationStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAntExpense?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalRef?: string;
}
