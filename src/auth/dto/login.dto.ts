import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description:
      'Correo electrónico, RUT (12345678-9) o nombre de usuario (handle)',
    example: 'ana@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'El identificador es obligatorio' })
  identifier!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;
}
