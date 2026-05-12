import {
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registro de usuario',
    description:
      'Crea una cuenta nueva. El email queda pendiente de verificación: ' +
      'se envía un código OTP de 6 dígitos al correo del usuario.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado correctamente',
    schema: {
      example: {
        user: {
          id: 'uuid-v4',
          fullName: 'Ana Pérez',
          email: 'ana@example.com',
          username: null,
          avatarUrl: null,
          emailVerified: false,
          trialEndsAt: '2026-05-25T00:00:00.000Z',
          createdAt: '2026-05-11T12:00:00.000Z',
        },
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'opaque-token-string',
        expiresIn: '15m',
        nextStep: 'email_verification',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validación fallida (contraseñas no coinciden, términos no aceptados, etc.)' })
  @ApiResponse({ status: 409, description: 'Ya existe una cuenta con ese correo' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Inicio de sesión' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión (revoca refresh token)' })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('email-verification/request')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ short: { limit: 3, ttl: 3600000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Solicitar código OTP de verificación de correo',
    description:
      'Envía un código de 6 dígitos al email indicado. ' +
      'Invalida cualquier código previo pendiente. ' +
      'Usar también para reenviar tras un cambio de correo.',
  })
  requestEmailVerification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestEmailVerificationDto,
  ) {
    return this.authService.requestEmailVerification(user.sub, dto.email);
  }

  @Post('email-verification/confirm')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Confirmar código OTP de 6 dígitos',
    description:
      'Valida el código recibido por correo. ' +
      'Máximo 5 intentos; al superarlos el código se invalida y hay que solicitar uno nuevo.',
  })
  confirmEmailVerification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmEmailVerificationDto,
  ) {
    return this.authService.confirmEmailVerification(user.sub, dto.email, dto.code);
  }

  @Post('email-verification/resend')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ short: { limit: 3, ttl: 3600000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Reenviar código OTP (invalida el anterior)',
    description: 'Máximo 3 reenvíos por hora.',
  })
  resendEmailVerification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestEmailVerificationDto,
  ) {
    return this.authService.requestEmailVerification(user.sub, dto.email);
  }
}
