import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestEmailVerificationDto {
  @ApiProperty({ example: 'tu@correo.cl' })
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email!: string;
}
