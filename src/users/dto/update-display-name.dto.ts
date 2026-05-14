import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDisplayNameDto {
  @ApiPropertyOptional({ example: 'Ana' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre debe tener al menos 1 carácter' })
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El apellido debe tener al menos 1 carácter' })
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    example: 'Ani',
    description: 'Alias de experiencia. No es único ni identificador.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El alias debe tener al menos 1 carácter' })
  @MaxLength(80)
  username?: string;
}
