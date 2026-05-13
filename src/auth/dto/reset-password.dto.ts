import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'usuario@ejemplo.com' })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;

  @ApiProperty({ description: 'Código OTP de 6 dígitos recibido por correo', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @Matches(/^\d{6}$/, { message: 'El código debe ser de 6 dígitos numéricos' })
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una mayúscula y un número',
  })
  newPassword: string;
}
