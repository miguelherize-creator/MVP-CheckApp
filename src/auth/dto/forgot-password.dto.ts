import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'Correo no válido' })
  email: string;
}
