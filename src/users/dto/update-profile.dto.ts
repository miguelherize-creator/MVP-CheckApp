import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
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
    description: 'Alias de experiencia. Solo letras, números, puntos, guiones y guiones bajos.',
    example: 'aniux',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El alias debe tener al menos 3 caracteres' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.\-]+$/, {
    message: 'El alias solo puede contener letras, números, puntos, guiones y guiones bajos',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'URL de avatar inválida' })
  @MaxLength(500)
  avatarUrl?: string;
}
