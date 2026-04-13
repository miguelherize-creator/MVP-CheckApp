import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @IsString()
  @IsNotEmpty({ message: 'El username es obligatorio' })
  @MinLength(3, { message: 'El username debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El username no puede superar 100 caracteres' })
  username!: string;

  @ApiProperty({
    description: 'Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir mayúscula, minúscula y número',
  })
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;
}