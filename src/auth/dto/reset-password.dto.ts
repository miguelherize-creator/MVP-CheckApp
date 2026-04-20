import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por correo (en claro)' })
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/, {
    message:
      'La contraseña debe incluir mayúscula, minúscula, número y carácter especial',
  })
  newPassword: string;
}
