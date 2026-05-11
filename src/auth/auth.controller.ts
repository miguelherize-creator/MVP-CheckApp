import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
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

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Registro de usuario' })
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

  /**
   * Endpoint público — recibe el token del magic link del correo.
   * Verifica la cuenta y redirige al deep link de la app con el resultado.
   * URL del email: GET /auth/email-verification/confirm/:token
   */
  @Get('email-verification/confirm/:token')
  @ApiOperation({
    summary: 'Confirmar email vía magic link (enlace del correo, sin JWT)',
    description:
      'El usuario llega aquí al hacer clic en el enlace del correo de verificación. ' +
      'Si el token es válido, marca el email como verificado y redirige al deep link de la app. ' +
      'Si es inválido/expirado, redirige con status=error.',
  })
  @Redirect()
  async confirmEmailViaLink(@Param('token') token: string) {
    const legacyBase = this.config.get<string>(
      'CONFIRM_ACCOUNT_URL',
      'http://localhost:8081/confirm-account',
    );
    const successBase = this.config.get<string>(
      'EMAIL_VERIFY_REDIRECT_SUCCESS_WEB',
      legacyBase,
    );
    const errorBase = this.config.get<string>(
      'EMAIL_VERIFY_REDIRECT_ERROR_WEB',
      legacyBase,
    );

    try {
      const result = await this.authService.confirmEmailVerificationByToken(token);
      return {
        url: this.buildRedirectUrl(successBase, {
          status: 'success',
          name: result.user?.fullName ?? '',
        }),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`email-verification/confirm failed: ${msg}`);
      return {
        url: this.buildRedirectUrl(errorBase, { status: 'error' }),
      };
    }
  }

  private buildRedirectUrl(base: string, params: Record<string, string>): string {
    const hasQuery = base.includes('?');
    const query = Object.entries(params)
      .filter(([, value]) => value !== '')
      .map(
        ([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');

    if (!query) return base;
    return `${base}${hasQuery ? '&' : '?'}${query}`;
  }

  @Post('email-verification/request')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Solicitar código de verificación de correo',
    description:
      'Se llama automáticamente post-registro. También permite solicitar verificación ' +
      'tras un cambio de correo vía perfil.',
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
  @ApiOperation({ summary: 'Confirmar código de verificación de correo (6 dígitos)' })
  confirmEmailVerification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmEmailVerificationDto,
  ) {
    return this.authService.confirmEmailVerification(user.sub, dto.email, dto.code);
  }

  @Post('email-verification/resend')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reenviar código de verificación (invalida el anterior)' })
  resendEmailVerification(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestEmailVerificationDto,
  ) {
    return this.authService.requestEmailVerification(user.sub, dto.email);
  }
}
