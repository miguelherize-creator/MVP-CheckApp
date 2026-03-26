import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from '../common/utils/crypto.utils';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepo: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.acceptTerms === false) {
      throw new BadRequestException('Debes aceptar los términos para registrarte');
    }
    const acceptedTermsAt =
      dto.acceptTerms === true ? new Date() : null;

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      acceptedTermsAt,
    });

    const tokens = await this.issueTokens(user);
    return {
      user: this.usersService.toPublic(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
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

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Respuesta genérica siempre
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
