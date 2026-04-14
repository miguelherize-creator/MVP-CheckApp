import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmEmailVerificationDto {
  @ApiProperty({ example: 'tu@correo.cl' })
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;

  @ApiProperty({ example: '482910', description: 'Código de 6 dígitos recibido por correo' })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos' })
  code!: string;
}
