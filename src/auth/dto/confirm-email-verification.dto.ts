import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @ApiProperty({ example: 'tu@correo.cl' })
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;

  @ApiProperty({ example: '482910', description: 'Código de 6 dígitos recibido por correo' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener exactamente 6 dígitos numéricos' })
  code!: string;
}
