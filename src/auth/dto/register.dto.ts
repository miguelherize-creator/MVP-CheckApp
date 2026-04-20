import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres' })
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El apellido no puede superar 100 caracteres' })
  lastName!: string;

  @ApiProperty({
    description: 'RUT chileno sin puntos, con guión (ej: 12345678-9 o 12345678-K)',
    example: '12345678-9',
  })
  @IsString()
  @IsNotEmpty({ message: 'El RUT es obligatorio' })
  @Matches(/^\d{7,8}-[\dkK]$/, {
    message: 'Formato de RUT inválido. Use el formato 12345678-9',
  })
  rut!: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;

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

  @ApiProperty({ description: 'Debe ser true para poder registrarse' })
  @IsBoolean({ message: 'Debes indicar si aceptas la política de privacidad' })
  acceptPrivacy!: boolean;
}
