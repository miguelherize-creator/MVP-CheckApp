import {
  BadRequestException,
  ConflictException,
  Injectable,
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
    if (dto.acceptTerms === false) {
      throw new BadRequestException('Debes aceptar los términos para registrarte');
    }

    const user = await this.usersService.create({
      username: dto.username,
      password: dto.password,
      acceptedTermsAt: dto.acceptTerms === true ? new Date() : null,
    });

    // Seed de fuentes de fondos (cashflow M4/M6)
    await this.cashflowSeed.ensureFundingSourcesForUser(user.id);

    // Determinar el paso inicial del onboarding según el tipo de identificador
    const isEmailFlow = user.identifierType === 'email';
    const initialStep = isEmailFlow ? 'email_verification' : 'email_collection';

    // Crear estado de onboarding
    await this.onboardingRepo.save(
      this.onboardingRepo.create({
        userId: user.id,
        currentStep: initialStep,
        financialProfileCompleted: false,
        goalsSet: false,
        importAttempted: false,
        biometricPrompted: false,
        completedAt: null,
      }),
    );

    // Crear preferencia biométrica inicial (desactivada)
    await this.biometricRepo.save(
      this.biometricRepo.create({
        userId: user.id,
        enabled: false,
        method: null,
        deviceId: null,
      }),
    );

    // Flow A: email → enviar código de verificación automáticamente
    if (isEmailFlow && user.email) {
      await this.requestEmailVerification(user.id, user.email);
    }

    const tokens = await this.issueTokens(user);
    return {
      user: this.usersService.toPublic(user),
      ...tokens,
      nextStep: initialStep,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsernameWithPassword(dto.username);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await this.usersService.validatePassword(
      dto.password,
      user.passwordHash,
    );
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
    if (
      !row ||
      row.revokedAt ||
      row.expiresAt.getTime() < Date.now()
    ) {
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

  async forgotPassword(emailOrUsername: string) {
    let user = await this.usersService.findByEmail(emailOrUsername);

    if (!user) {
      user = await this.usersService.findByUsername(emailOrUsername);
    }

    const generic = {
      message:
        'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.',
    };

    if (!user || !user.email) {
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
    if (
      !row ||
      row.usedAt ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token inválido o expirado');
    }
    await this.usersService.updatePassword(row.userId, newPassword);
    row.usedAt = new Date();
    await this.resetRepo.save(row);
    await this.revokeAllRefreshForUser(row.userId);
    return { message: 'Contraseña actualizada correctamente' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await this.usersService.validatePassword(
      currentPassword,
      user.passwordHash,
    );
    if (!ok) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }
    await this.usersService.updatePassword(userId, newPassword);
    await this.revokeAllRefreshForUser(userId);
    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Genera un código de 6 dígitos, lo almacena (hash SHA-256) y lo envía al correo.
   * Invalida cualquier token de verificación previo del mismo usuario.
   * Flujo A: usuario se registró con email → llama aquí automáticamente post-registro.
   * Flujo B: usuario se registró con RUT/username → llama aquí desde la pantalla EmailVerification.
   */
  async requestEmailVerification(userId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // Verificar que el correo no esté en uso por otro usuario
    const existing = await this.usersService.findByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Este correo ya está registrado por otra cuenta');
    }

    // Invalidar tokens previos del mismo usuario
    await this.emailVerifRepo
      .createQueryBuilder()
      .update(EmailVerificationToken)
      .set({ usedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .execute();

    // Generar código de 6 dígitos y guardarlo como hash
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = hashOpaqueToken(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await this.emailVerifRepo.save(
      this.emailVerifRepo.create({
        userId,
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    await this.mailService.sendEmailVerificationCode(normalizedEmail, code);

    return { message: `Código de verificación enviado a ${normalizedEmail}` };
  }

  /**
   * Valida el código de 6 dígitos y actualiza el correo verificado del usuario.
   * Marca el token como usado para evitar reutilización.
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

    // Marcar token como usado
    row.usedAt = new Date();
    await this.emailVerifRepo.save(row);

    // Actualizar email y email_verified_at del usuario
    const updatedUser = await this.usersService.setEmailVerified(userId, normalizedEmail);

    // Avanzar el onboarding al siguiente paso
    await this.onboardingRepo
      .createQueryBuilder()
      .update(OnboardingState)
      .set({ currentStep: 'profile' })
      .where('user_id = :userId', { userId })
      .andWhere('current_step IN (:...steps)', {
        steps: ['email_verification', 'email_collection'],
      })
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
      username: user.username,
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
