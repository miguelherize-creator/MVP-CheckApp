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

const BCRYPT_ROUNDS = 12;

/** Normaliza RUT: elimina puntos y pone K en mayúscula. Ej: "12.345.678-k" → "12345678-K" */
function normalizeRut(rut: string): string {
  return rut.replace(/\./g, '').toUpperCase();
}

/** Detecta si el identificador de login es un RUT chileno normalizado. */
function isRutFormat(identifier: string): boolean {
  return /^\d{7,8}-[\dK]$/.test(identifier);
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    rut: string;
    password: string;
    acceptedTermsAt?: Date | null;
    acceptedPrivacyAt?: Date | null;
  }): Promise<User> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedRut = normalizeRut(data.rut.trim());

    const emailExists = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
    if (emailExists) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico');
    }

    const rutExists = await this.usersRepo.findOne({ where: { rut: normalizedRut } });
    if (rutExists) {
      throw new ConflictException('Ya existe una cuenta con este RUT');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = this.usersRepo.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: normalizedEmail,
      rut: normalizedRut,
      username: null,
      passwordHash,
      acceptedTermsAt: data.acceptedTermsAt ?? null,
      acceptedPrivacyAt: data.acceptedPrivacyAt ?? null,
      emailVerifiedAt: null,
    });

    return this.usersRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findByRut(rut: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { rut: normalizeRut(rut.trim()) } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username: username.trim().toLowerCase() } });
  }

  /**
   * Busca usuario por cualquier identificador de login (email, RUT o username).
   * Incluye passwordHash para validación de credenciales.
   */
  async findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();

    if (trimmed.includes('@')) {
      return this.usersRepo
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('LOWER(user.email) = :email', { email: trimmed.toLowerCase() })
        .getOne();
    }

    const normalized = normalizeRut(trimmed);
    if (isRutFormat(normalized)) {
      return this.usersRepo
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.rut = :rut', { rut: normalized })
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
      .where('user.id = :id', { id })
      .getOne();
  }

  async validatePassword(plain: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }

  async updatePassword(userId: string, newPlainPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPlainPassword, BCRYPT_ROUNDS);
    const res = await this.usersRepo.update(userId, { passwordHash });
    if (!res.affected) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  /**
   * Guarda un correo nuevo (sin verificar) en el perfil del usuario.
   * Usado al solicitar verificación de un email diferente al actual.
   */
  async setPendingEmail(userId: string, email: string): Promise<void> {
    await this.usersRepo.update(userId, {
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

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }

    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }

    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.trim().toLowerCase();
      const existing = await this.usersRepo.findOne({ where: { username: normalizedUsername } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Este nombre de usuario ya está en uso');
      }
      user.username = normalizedUsername;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
        if (existing && existing.id !== userId) {
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
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      rut: user.rut,
      username: user.username,
      emailVerifiedAt: user.emailVerifiedAt,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}
