import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, Length, MaxLength } from 'class-validator';

export class UpsertFinancialProfileDto {
  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monthlyIncomeEstimate?: number;

  @ApiPropertyOptional({ example: 'Arriendo $400.000, servicios $80.000' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  stableExpensesNote?: string;

  @ApiPropertyOptional({ example: 300000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedPaymentCapacity?: number;

  @ApiPropertyOptional({ example: 'CLP', default: 'CLP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
