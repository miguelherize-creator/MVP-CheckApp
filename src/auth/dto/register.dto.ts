import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede superar 200 caracteres' })
  fullName!: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;

  @ApiPropertyOptional({
    description: 'Número de documento (ej: RUT chileno 12345678-9)',
    example: '12345678-9',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNumber?: string;

  @ApiProperty({
    description:
      'Mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial',
    example: 'Segura@123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/, {
    message:
      'La contraseña debe incluir mayúscula, minúscula, número y carácter especial',
  })
  password!: string;

  @ApiProperty({ example: 'Segura@123' })
  @IsString()
  @IsNotEmpty({ message: 'La confirmación de contraseña es obligatoria' })
  confirmPassword!: string;

  @ApiProperty({ description: 'Debe ser true para poder registrarse' })
  @IsBoolean({ message: 'Debes indicar si aceptas los términos' })
  acceptTerms!: boolean;
}
