import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @ApiPropertyOptional({ enum: FlowType })
  @IsOptional()
  @IsEnum(FlowType)
  flowType?: FlowType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fundingSourceId?: string | null;

  @ApiPropertyOptional({
    description: 'Cuenta de destino. Enviar null para limpiar el valor.',
  })
  @IsOptional()
  @IsUUID()
  destinationFundingSourceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredOn?: string;

  @ApiPropertyOptional({
    description: 'Descripción legible para el usuario. La glosa original (bankDescription) no es editable.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: CategorizationStatus,
    description:
      'Permite al usuario marcar un movimiento como revisado (categorized) ' +
      'o dejarlo como uncategorized.',
  })
  @IsOptional()
  @IsEnum(CategorizationStatus)
  categorizationStatus?: CategorizationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAntExpense?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalRef?: string | null;
}
