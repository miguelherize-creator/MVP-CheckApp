import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const BIOMETRIC_METHODS = ['face_id', 'fingerprint', 'device_pin'] as const;

export class UpdateBiometricDto {
  @ApiProperty({ description: 'Activar o desactivar autenticación biométrica' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ enum: BIOMETRIC_METHODS, description: 'Obligatorio al activar' })
  @IsOptional()
  @IsIn(BIOMETRIC_METHODS, { message: 'Método no válido. Usar: face_id, fingerprint o device_pin' })
  method?: string;

  @ApiPropertyOptional({ description: 'Identificador del dispositivo' })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
