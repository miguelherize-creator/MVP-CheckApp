import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateOnboardingStepDto {
  @ApiPropertyOptional({ description: 'Paso actual: profile, goals, import, biometric' })
  @IsOptional()
  @IsString()
  currentStep?: string;

  @ApiPropertyOptional({ description: 'Pantalla donde retomar: home, onboarding' })
  @IsOptional()
  @IsString()
  resumeSurface?: string;

  @ApiPropertyOptional({ description: 'Contexto extra para retomar (JSON libre)' })
  @IsOptional()
  @IsObject()
  resumeContext?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  financialProfileCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  goalsSet?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  importAttempted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  biometricPrompted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  minDocThresholdMet?: boolean;
}
