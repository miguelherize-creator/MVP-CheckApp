import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana.perez' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  username!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;
}