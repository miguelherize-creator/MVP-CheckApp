import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDisplayNameDto {
  @ApiPropertyOptional({
    example: 'Ana Pérez',
    description: 'Nombre completo — la app concatena nombre + apellido antes de enviar',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200)
  fullName?: string;

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
