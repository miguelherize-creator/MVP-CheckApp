import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
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
import { UpdateBiometricDto } from './dto/update-biometric.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  generateOpaqueToken,
  generateSixDigitCode,
  hashOpaqueToken,
} from '../common/utils/crypto.utils';
import { User } from '../users/entities/user.entity';
import { UserGamificationStats } from '../gamification/entities/user-gamification-stats.entity';
import { CashflowSeedService } from '../cashflow/services/cashflow-seed.service';
import { CatalogSeedService } from '../catalog/catalog-seed.service';
import { getDocumentValidator } from '../common/validators/document/document-validator.factory';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly cashflowSeed: CashflowSeedService,
    private readonly catalogSeed: CatalogSeedService,
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
    @InjectRepository(UserGamificationStats)
    private readonly gamificationStatsRepo: Repository<UserGamificationStats>,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptTerms) {
      throw new BadRequestException('Debes aceptar los términos para registrarte');
    }
    if (!dto.acceptPrivacy) {
      throw new BadRequestException('Debes aceptar la política de privacidad para registrarte');
    }

    const defaults = this.catalogSeed.getDefaults();
    const docValidator = getDocumentValidator(defaults.rutDocumentTypeCode);
    if (docValidator && !docValidator.validate(dto.documentNumber)) {
      throw new BadRequestException(docValidator.errorMessage);
    }

    const now = new Date();
    const user = await this.usersService.create({
      email: dto.email,
      documentNumber: dto.documentNumber,
      documentTypeId: defaults.rutDocumentTypeId,
      password: dto.password,
      acceptedTermsAt: now,
      acceptedPrivacyAt: now,
      trialDays: this.config.get<number>('TRIAL_DAYS_DEFAULT', 14),
    });

    await this.cashflowSeed.ensureFundingSourcesForUser(user.userId);

    await this.onboardingRepo.save(
      this.onboardingRepo.create({
        userId: user.userId,
        onboardingStatus: 'not_started',
        currentStep: 'email_verification',
        financialProfileCompleted: false,
        goalsSet: false,
        importAttempted: false,
        biometricPrompted: false,
        minDocThresholdMet: false,
        completedAt: null,
        resumeSurface: null,
        resumeContext: null,
      }),
    );

    await this.biometricRepo.save(
      this.biometricRepo.create({
        userId: user.userId,
        enabled: false,
        method: null,
        deviceId: null,
      }),
    );

    await this.gamificationStatsRepo.save(
      this.gamificationStatsRepo.create({
        userId: user.userId,
        totalPoints: 0,
        level: 1,
        lastComputedAt: new Date(),
      }),
    );

    // OTP persisted; SMTP puede tardar — no bloquear la respuesta HTTP del registro
    const otpPayload = await this.buildOtpAndPersist(user.userId, user.email!);
    void this.mailService
      .sendEmailVerificationCode(otpPayload.normalizedEmail, otpPayload.code)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Código de verificación no enviado tras registro (${otpPayload.normalizedEmail}): ${msg}`,
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
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await this.usersService.validatePassword(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const defaults = this.catalogSeed.getDefaults();

    if (user.userStatusId === defaults.pendingVerificationStatusId) {
      // Emitir tokens para que el usuario pueda llamar a /email-verification/resend
      // y completar la verificación sin quedar atascado.
      const tokens = await this.issueTokens(user);
      void this.requestEmailVerification(user.userId, user.email!)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`OTP auto-resend on login failed for ${user.email}: ${msg}`);
        });
      return {
        user: this.usersService.toPublic(user),
        ...tokens,
        nextStep: 'email_verification',
      };
    }

    if (user.userStatusId === defaults.suspendedStatusId) {
      throw new ForbiddenException('Tu cuenta ha sido suspendida. Contacta soporte.');
    }

    if (user.userStatusId !== defaults.activeStatusId) {
      throw new ForbiddenException('Tu cuenta no está disponible. Contacta soporte.');
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.usersService.toPublic(user),
      ...tokens,
    };
  }

  async refresh(refreshTokenPlain: string) {
    const hash = hashOpaqueToken(refreshTokenPlain);
    const row = await this.refreshRepo.findOne({ where: { tokenHash: hash } });

    if (!row) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    // Token ya revocado → posible replay attack; cerrar todas las sesiones del usuario
    if (row.revokedAt) {
      await this.revokeAllRefreshForUser(row.userId);
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    if (row.expiresAt.getTime() < Date.now()) {
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

    await this.resetRepo.delete({ userId: user.userId });

    const plain = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(plain);
    const minutes = this.config.get<number>('PASSWORD_RESET_EXPIRES_MINUTES', 60);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    await this.resetRepo.save(
      this.resetRepo.create({
        userId: user.userId,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    await this.mailService.sendPasswordResetEmail(user.email!, plain);
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
    if (!user || !user.passwordHash) {
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

  async requestEmailVerification(userId: string, email: string) {
    const p = await this.buildOtpAndPersist(userId, email);
    await this.mailService.sendEmailVerificationCode(p.normalizedEmail, p.code);
    return { message: `Código de verificación enviado a ${p.normalizedEmail}` };
  }

  /** Genera código OTP de 6 dígitos, invalida tokens anteriores y persiste el nuevo. */
  private async buildOtpAndPersist(
    userId: string,
    email: string,
  ): Promise<{ normalizedEmail: string; code: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing && existing.userId !== userId) {
      throw new ConflictException('Este correo ya está registrado por otra cuenta');
    }

    await this.emailVerifRepo
      .createQueryBuilder()
      .update(EmailVerificationToken)
      .set({ usedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .execute();

    const code      = generateSixDigitCode();
    const tokenHash = hashOpaqueToken(code);
    const minutes   = this.config.get<number>('EMAIL_VERIFICATION_EXPIRES_MINUTES', 15);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    await this.emailVerifRepo.save(
      this.emailVerifRepo.create({
        userId,
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        usedAt: null,
        attempts: 0,
      }),
    );

    const user = await this.usersService.findById(userId);
    if (user && user.email !== normalizedEmail) {
      await this.usersService.setPendingEmail(userId, normalizedEmail);
    }

    return { normalizedEmail, code };
  }

  async confirmEmailVerification(userId: string, email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const rows = await this.emailVerifRepo.find({
      where: { userId, usedAt: undefined as any },
      order: { createdAt: 'DESC' },
    });
    const row = rows.find((r) => r.usedAt === null);

    if (!row) {
      throw new BadRequestException('No hay un código pendiente. Solicita uno nuevo.');
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código expiró. Solicita uno nuevo.');
    }

    const MAX_ATTEMPTS = 5;
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo código.');
    }

    const tokenHash = hashOpaqueToken(code);
    if (row.tokenHash !== tokenHash) {
      row.attempts += 1;
      if (row.attempts >= MAX_ATTEMPTS) {
        row.usedAt = new Date();
      }
      await this.emailVerifRepo.save(row);
      const remaining = MAX_ATTEMPTS - row.attempts;
      if (remaining > 0) {
        throw new BadRequestException(`Código incorrecto. ${remaining} intentos restantes.`);
      }
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo código.');
    }

    if (row.email !== normalizedEmail) {
      throw new BadRequestException('El correo no coincide con el código enviado.');
    }

    row.usedAt = new Date();
    await this.emailVerifRepo.save(row);

    const updatedUser = await this.usersService.setEmailVerified(userId, normalizedEmail);

    await this.onboardingRepo
      .createQueryBuilder()
      .update(OnboardingState)
      .set({ onboardingStatus: 'in_progress', currentStep: 'profile' })
      .where('user_id = :userId', { userId })
      .andWhere('current_step = :step', { step: 'email_verification' })
      .execute();

    return {
      message: 'Correo verificado correctamente',
      user: this.usersService.toPublic(updatedUser),
    };
  }

  async updateBiometric(userId: string, dto: UpdateBiometricDto) {
    if (dto.enabled && !dto.method) {
      throw new BadRequestException('El método biométrico es obligatorio al activar');
    }

    const prefs = await this.biometricRepo.findOne({ where: { userId } });
    if (!prefs) {
      throw new NotFoundException('Preferencias biométricas no encontradas');
    }

    prefs.enabled = dto.enabled;
    if (dto.enabled) {
      prefs.method = dto.method!;
      prefs.deviceId = dto.deviceId ?? null;
      await this.onboardingRepo
        .createQueryBuilder()
        .update(OnboardingState)
        .set({ biometricPrompted: true })
        .where('user_id = :userId', { userId })
        .execute();
    } else {
      prefs.method = null;
      prefs.deviceId = null;
    }

    const saved = await this.biometricRepo.save(prefs);
    return {
      enabled: saved.enabled,
      method: saved.method,
      deviceId: saved.deviceId,
      updatedAt: saved.updatedAt,
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
      sub: user.userId,
      email: user.email!,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshPlain = generateOpaqueToken();
    const refreshHash = hashOpaqueToken(refreshPlain);
    const days = this.config.get<number>('REFRESH_EXPIRES_DAYS', 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.userId,
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
