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
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;

  @ApiProperty({
    description: 'Número de documento (RUT chileno, ej: 12345678-9)',
    example: '12345678-5',
  })
  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @MaxLength(50)
  documentNumber!: string;

  @ApiProperty({
    description: 'Mínimo 8 caracteres, al menos una mayúscula y un número',
    example: 'Walvy2024',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una mayúscula y un número',
  })
  password!: string;

  @ApiProperty({ description: 'Debe ser true para poder registrarse' })
  @IsBoolean({ message: 'Debes indicar si aceptas los términos' })
  acceptTerms!: boolean;

  @ApiProperty({ description: 'Debe ser true para poder registrarse' })
  @IsBoolean({ message: 'Debes indicar si aceptas la política de privacidad' })
  acceptPrivacy!: boolean;
}
