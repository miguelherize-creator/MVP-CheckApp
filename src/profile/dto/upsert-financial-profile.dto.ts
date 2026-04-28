import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UpsertFinancialProfileDto {
  @ApiPropertyOptional({
    description: 'Ingreso mensual estimado del usuario',
    example: 1500000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monthlyIncomeEstimate?: number;

  @ApiPropertyOptional({
    description: 'Nota libre sobre gastos fijos estables (arriendo, servicios, etc.)',
    example: 'Arriendo $400.000, servicios básicos $80.000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  stableExpensesNote?: string;

  @ApiPropertyOptional({
    description: 'Capacidad de pago mensual estimada',
    example: 300000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedPaymentCapacity?: number;

  @ApiPropertyOptional({
    description: 'Moneda (ISO 4217)',
    example: 'CLP',
    default: 'CLP',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
