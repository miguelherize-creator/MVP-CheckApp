import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { BiometricPreferences } from './entities/biometric-preferences.entity';
import { OnboardingState } from './entities/onboarding-state.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from '../common/utils/crypto.utils';
import { User } from '../users/entities/user.entity';
import { CashflowSeedService } from '../cashflow/services/cashflow-seed.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly cashflowSeed: CashflowSeedService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepo: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailVerifRepo: Repository<EmailVerificationToken>,
    @InjectRepository(BiometricPreferences)
    private readonly biometricRepo: Repository<BiometricPreferences>,
    @InjectRepository(OnboardingState)
    private readonly onboardingRepo: Repository<OnboardingState>,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptTerms) {
      throw new BadRequestException('Debes aceptar los términos para registrarte');
    }
    if (!dto.acceptPrivacy) {
      throw new BadRequestException('Debes aceptar la política de privacidad para registrarte');
    }
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      rut: dto.rut,
      password: dto.password,
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    });

    await this.cashflowSeed.ensureFundingSourcesForUser(user.id);

    await this.onboardingRepo.save(
      this.onboardingRepo.create({
        userId: user.id,
        currentStep: 'email_verification',
        financialProfileCompleted: false,
        goalsSet: false,
        importAttempted: false,
        biometricPrompted: false,
        completedAt: null,
      }),
    );

    await this.biometricRepo.save(
      this.biometricRepo.create({
        userId: user.id,
        enabled: false,
        method: null,
        deviceId: null,
      }),
    );

    // Token en BD ya; SMTP puede tardar — no bloquear la respuesta HTTP del registro
    const mailPayload = await this.buildEmailVerificationMailPayload(user.id, user.email);
    void this.mailService
      .sendEmailVerificationLink(
        mailPayload.normalizedEmail,
        mailPayload.firstName,
        mailPayload.lastName,
        mailPayload.verifyUrl,
      )
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Correo de verificación no enviado tras registro (${mailPayload.normalizedEmail}): ${msg}`,
        );
      });

    const tokens = await this.issueTokens(user);
    return {
      user: this.usersService.toPublic(user),
      ...tokens,
      nextStep: 'email_verification',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByIdentifierWithPassword(dto.identifier);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await this.usersService.validatePassword(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const tokens = await this.issueTokens(user);
    return {
      user: this.usersService.toPublic(user),
      ...tokens,
    };
  }

  async refresh(refreshTokenPlain: string) {
    const hash = hashOpaqueToken(refreshTokenPlain);
    const row = await this.refreshRepo.findOne({
      where: { tokenHash: hash },
      relations: ['user'],
    });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    const user = await this.usersService.findById(row.userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    row.revokedAt = new Date();
    await this.refreshRepo.save(row);
    return this.issueTokens(user);
  }

  async logout(refreshTokenPlain: string) {
    const hash = hashOpaqueToken(refreshTokenPlain);
    const row = await this.refreshRepo.findOne({ where: { tokenHash: hash } });
    if (row && !row.revokedAt) {
      row.revokedAt = new Date();
      await this.refreshRepo.save(row);
    }
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    const generic = {
      message:
        'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.',
    };

    if (!user) {
      return generic;
    }

    await this.resetRepo.delete({ userId: user.id });

    const plain = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(plain);
    const minutes = this.config.get<number>('PASSWORD_RESET_EXPIRES_MINUTES', 60);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    await this.resetRepo.save(
      this.resetRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    await this.mailService.sendPasswordResetEmail(user.email, plain);
    return generic;
  }

  async resetPassword(plainToken: string, newPassword: string) {
    const hash = hashOpaqueToken(plainToken);
    const row = await this.resetRepo.findOne({
      where: { tokenHash: hash },
      relations: ['user'],
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.usersService.updatePassword(row.userId, newPassword);
    row.usedAt = new Date();
    await this.resetRepo.save(row);
    await this.revokeAllRefreshForUser(row.userId);
    return { message: 'Contraseña actualizada correctamente' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await this.usersService.validatePassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }
    await this.usersService.updatePassword(userId, newPassword);
    await this.revokeAllRefreshForUser(userId);
    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Genera un token opaco URL-safe (32 bytes hex), lo almacena hasheado y envía
   * un email con el enlace de confirmación (magic link).
   * Invalida tokens previos del mismo usuario.
   * Si el email difiere del almacenado (cambio de correo), lo marca como pendiente.
   */
  async requestEmailVerification(userId: string, email: string) {
    const p = await this.buildEmailVerificationMailPayload(userId, email);
    await this.mailService.sendEmailVerificationLink(
      p.normalizedEmail,
      p.firstName,
      p.lastName,
      p.verifyUrl,
    );
    return { message: `Enlace de verificación enviado a ${p.normalizedEmail}` };
  }

  /**
   * Persistencia + URL del magic link; el envío SMTP lo decide el llamador (sync o en background).
   */
  private async buildEmailVerificationMailPayload(
    userId: string,
    email: string,
  ): Promise<{
    normalizedEmail: string;
    firstName: string;
    lastName: string;
    verifyUrl: string;
  }> {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Este correo ya está registrado por otra cuenta');
    }

    await this.emailVerifRepo
      .createQueryBuilder()
      .update(EmailVerificationToken)
      .set({ usedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .execute();

    const plain = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(plain);
    const hours = this.config.get<number>('EMAIL_VERIFICATION_EXPIRES_HOURS', 24);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await this.emailVerifRepo.save(
      this.emailVerifRepo.create({
        userId,
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    const user = await this.usersService.findById(userId);
    if (user && user.email !== normalizedEmail) {
      await this.usersService.setPendingEmail(userId, normalizedEmail);
    }

    const template = this.config.get<string>(
      'EMAIL_VERIFICATION_URL_TEMPLATE',
      'http://localhost:3000/auth/email-verification/confirm/{{token}}',
    );
    const verifyUrl = template.includes('{{token}}')
      ? template.replace('{{token}}', encodeURIComponent(plain))
      : `${template}${template.includes('?') ? '&' : '?'}token=${encodeURIComponent(plain)}`;

    const firstName = user?.firstName ?? '';
    const lastName = user?.lastName ?? '';

    return { normalizedEmail, firstName, lastName, verifyUrl };
  }

  /**
   * Confirma el email a través del token del magic link (endpoint público, sin JWT).
   * El token viene directamente desde el enlace del correo.
   *
   * Idempotente: si el enlace ya se consumió pero el usuario ya quedó verificado
   * (p. ej. antivirus del correo abrió el link antes), devuelve éxito de nuevo.
   */
  async confirmEmailVerificationByToken(plainToken: string) {
    const normalizedPlain = this.normalizeMagicLinkToken(plainToken);
    const tokenHash = hashOpaqueToken(normalizedPlain);

    const row = await this.emailVerifRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!row) {
      throw new BadRequestException('Enlace inválido o expirado');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Enlace inválido o expirado');
    }

    if (row.usedAt) {
      const already = await this.usersService.findById(row.userId);
      if (already?.emailVerifiedAt) {
        return {
          message: 'Correo verificado correctamente',
          user: this.usersService.toPublic(already),
        };
      }
      throw new BadRequestException('Enlace inválido o expirado');
    }

    row.usedAt = new Date();
    await this.emailVerifRepo.save(row);

    const updatedUser = await this.usersService.setEmailVerified(row.userId, row.email);

    await this.onboardingRepo
      .createQueryBuilder()
      .update(OnboardingState)
      .set({ currentStep: 'profile' })
      .where('user_id = :userId', { userId: row.userId })
      .andWhere('current_step = :step', { step: 'email_verification' })
      .execute();

    return {
      message: 'Correo verificado correctamente',
      user: this.usersService.toPublic(updatedUser),
    };
  }

  /** Algunos clientes codifican el token en la URL más de una vez. */
  private normalizeMagicLinkToken(raw: string): string {
    let t = raw.trim();
    for (let i = 0; i < 3; i++) {
      try {
        const next = decodeURIComponent(t);
        if (next === t) break;
        t = next;
      } catch {
        break;
      }
    }
    return t;
  }

  /**
   * @deprecated Mantener para compatibilidad con el flujo de código OTP anterior.
   * Usar confirmEmailVerificationByToken() para el nuevo flujo de magic link.
   */
  async confirmEmailVerification(userId: string, email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const tokenHash = hashOpaqueToken(code);

    const row = await this.emailVerifRepo.findOne({
      where: { tokenHash, userId },
    });

    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Código inválido o expirado');
    }

    if (row.email !== normalizedEmail) {
      throw new BadRequestException('El correo no coincide con el código enviado');
    }

    row.usedAt = new Date();
    await this.emailVerifRepo.save(row);

    const updatedUser = await this.usersService.setEmailVerified(userId, normalizedEmail);

    await this.onboardingRepo
      .createQueryBuilder()
      .update(OnboardingState)
      .set({ currentStep: 'profile' })
      .where('user_id = :userId', { userId })
      .andWhere('current_step = :step', { step: 'email_verification' })
      .execute();

    return {
      message: 'Correo verificado correctamente',
      user: this.usersService.toPublic(updatedUser),
    };
  }

  private async revokeAllRefreshForUser(userId: string): Promise<void> {
    await this.refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshPlain = generateOpaqueToken();
    const refreshHash = hashOpaqueToken(refreshPlain);
    const days = this.config.get<number>('REFRESH_EXPIRES_DAYS', 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt,
        revokedAt: null,
      }),
    );
    return {
      accessToken,
      refreshToken: refreshPlain,
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
    };
  }
}
