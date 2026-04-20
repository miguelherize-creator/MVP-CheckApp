import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Handle/alias opcional. Solo letras, números, puntos, guiones y guiones bajos',
    example: 'aniux',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.\-]+$/, {
    message:
      'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Correo no válido' })
  email?: string;
}
