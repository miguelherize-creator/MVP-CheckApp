import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'Correo no válido' })
  email: string;

  @ApiProperty({
    description: 'Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'La contraseña debe incluir mayúscula, minúscula y número',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'Si el negocio exige aceptación explícita de términos',
  })
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;
}
