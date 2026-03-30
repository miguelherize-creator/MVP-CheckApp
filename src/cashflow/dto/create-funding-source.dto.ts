import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { FundingSourceKind } from '../enums/funding-source-kind.enum';

export class CreateFundingSourceDto {
  @ApiProperty({ example: 'cc' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code: string;

  @ApiProperty({ example: 'Cuenta Corriente' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: FundingSourceKind })
  @IsEnum(FundingSourceKind)
  type: FundingSourceKind;

  @ApiPropertyOptional({
    description: 'Metadatos libres (últimos dígitos, banco, etc.)',
    default: {},
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
