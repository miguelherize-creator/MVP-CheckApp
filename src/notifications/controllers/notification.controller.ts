import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { NotificationService } from '../services/notification.service';
import { AlertType } from '../services/alert-rules.engine';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class TogglePreferenceDto {
  @IsEnum(AlertType)
  alertType: AlertType;

  @IsBoolean()
  enabled: boolean;
}

export class UpsertAlertPreferenceDto {
  @IsEnum(AlertType)
  alertType: AlertType;

  @IsString()
  channel: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsString()
  intensity?: string;

  @IsOptional() @IsInt() @Min(1)
  cadenceDays?: number;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ── Pantalla "Mis Avisos" ─────────────────────────────────────────────────

  @Get('preferences/sections')
  @ApiOperation({
    summary: 'Preferencias agrupadas por sección — para renderizar la pantalla Mis Avisos',
    description: 'Devuelve las secciones "Mis pagos", "Mi presupuesto" y "Mensajes" con el estado del toggle de cada alerta.',
  })
  getPreferencesBySections(@CurrentUser() user: JwtPayload) {
    return this.notificationService.getPreferencesBySections(user.sub);
  }

  @Patch('preferences/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activar o desactivar una alerta (toggle de la pantalla)',
    description: 'El frontend llama a este endpoint cuando el usuario mueve el switch de una alerta.',
  })
  @ApiBody({ type: TogglePreferenceDto })
  togglePreference(@CurrentUser() user: JwtPayload, @Body() dto: TogglePreferenceDto) {
    return this.notificationService.togglePreference(user.sub, dto.alertType, dto.enabled);
  }

  // ── Preferencias generales ────────────────────────────────────────────────

  @Post('preferences')
  @ApiOperation({ summary: 'Crear o actualizar una preferencia (uso avanzado)' })
  upsertPreference(@CurrentUser() user: JwtPayload, @Body() dto: UpsertAlertPreferenceDto) {
    return this.notificationService.upsertPreference(user.sub, dto);
  }

  @Post('preferences/defaults')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicializar preferencias por defecto (onboarding)' })
  async createDefaults(@CurrentUser() user: JwtPayload) {
    await this.notificationService.createDefaultPreferences(user.sub);
    return { message: 'Preferencias por defecto creadas' };
  }

  // ── Cola in-app ───────────────────────────────────────────────────────────

  @Get('pending')
  @ApiOperation({ summary: 'Alertas in-app pendientes de leer' })
  getPending(@CurrentUser() user: JwtPayload) {
    return this.notificationService.getPendingInApp(user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'Historial de notificaciones (últimas 50)' })
  getHistory(@CurrentUser() user: JwtPayload) {
    return this.notificationService.getHistory(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markAsRead(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsSent(id, user.sub);
  }
}
