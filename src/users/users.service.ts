import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CatalogSeedService } from '../catalog/catalog-seed.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly catalogSeed: CatalogSeedService,
  ) {}

  async create(data: {
    fullName: string;
    email: string;
    password: string;
    documentNumber?: string | null;
    acceptedTermsAt?: Date | null;
  }): Promise<User> {
    const normalizedEmail = data.email.trim().toLowerCase();

    const emailExists = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
    if (emailExists) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const defaults = this.catalogSeed.getDefaults();

    const user = this.usersRepo.create({
      email: normalizedEmail,
      passwordHash,
      fullName: data.fullName.trim(),
      documentNumber: data.documentNumber?.trim() ?? null,
      identifierType: 'email',
      countryId: defaults.countryId,
      defaultCurrencyId: defaults.currencyId,
      roleId: defaults.roleId,
      userStatusId: defaults.userStatusId,
      acceptedTermsAt: data.acceptedTermsAt ?? null,
      emailVerifiedAt: null,
      username: null,
      avatarUrl: null,
      notificationEmail: null,
      notificationEmailVerifiedAt: null,
      authProvider: null,
      authProviderUserId: null,
      trialStartedAt: null,
      trialEndsAt: null,
      currentFinancialHealthLevelId: null,
      financialHealthUpdatedAt: null,
    });

    return this.usersRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { userId: id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username: username.trim().toLowerCase() } });
  }

  async findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();

    if (trimmed.includes('@')) {
      return this.usersRepo
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('LOWER(user.email) = :email', { email: trimmed.toLowerCase() })
        .getOne();
    }

    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.username) = :username', { username: trimmed.toLowerCase() })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.userId = :id', { id })
      .getOne();
  }

  async validatePassword(plain: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }

  async updatePassword(userId: string, newPlainPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPlainPassword, BCRYPT_ROUNDS);
    const res = await this.usersRepo.update({ userId }, { passwordHash });
    if (!res.affected) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async setPendingEmail(userId: string, email: string): Promise<void> {
    await this.usersRepo.update({ userId }, {
      email: email.toLowerCase(),
      emailVerifiedAt: null,
    });
  }

  async setEmailVerified(userId: string, email: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    user.email = email.toLowerCase();
    user.emailVerifiedAt = new Date();
    return this.usersRepo.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName.trim();
    }

    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.trim().toLowerCase();
      const existing = await this.usersRepo.findOne({ where: { username: normalizedUsername } });
      if (existing && existing.userId !== userId) {
        throw new ConflictException('Este nombre de usuario ya está en uso');
      }
      user.username = normalizedUsername;
    }

    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
        if (existing && existing.userId !== userId) {
          throw new ConflictException('Este correo ya está registrado por otra cuenta');
        }
        user.email = normalizedEmail;
        user.emailVerifiedAt = null;
      }
    }

    return this.usersRepo.save(user);
  }

  toPublic(user: User) {
    return {
      id: user.userId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      documentNumber: user.documentNumber,
      emailVerifiedAt: user.emailVerifiedAt,
      emailVerified: !!user.emailVerifiedAt,
      countryId: user.countryId,
      defaultCurrencyId: user.defaultCurrencyId,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      createdAt: user.createdAt,
    };
  }
}
