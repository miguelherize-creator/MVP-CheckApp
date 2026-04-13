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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(data: {
    username: string;
    password: string;
    acceptedTermsAt?: Date | null;
  }): Promise<User> {
    const normalizedUsername = data.username.trim().toLowerCase();

    const existingUsername = await this.usersRepo.findOne({
      where: { username: normalizedUsername },
    });

    if (existingUsername) {
      throw new ConflictException('Ya existe un usuario con este username');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const isEmailUsername = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername);

    const user = this.usersRepo.create({
      username: normalizedUsername,
      email: isEmailUsername ? normalizedUsername : null,
      name: null,
      passwordHash,
      acceptedTermsAt: data.acceptedTermsAt ?? null,
      emailVerifiedAt: null,
    });

    return this.usersRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { username: username.toLowerCase() },
    });
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: username.toLowerCase() })
      .getOne();
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async validatePassword(
    plain: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }

  async updatePassword(userId: string, newPlainPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPlainPassword, BCRYPT_ROUNDS);
    const res = await this.usersRepo.update(userId, { passwordHash });
    if (!res.affected) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.email !== undefined) {
      user.email = dto.email ? dto.email.toLowerCase() : null;
      user.emailVerifiedAt = null;
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    return this.usersRepo.save(user);
  }

  toPublic(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      needsEmailOnboarding: !user.email,
      emailVerified: !!user.emailVerifiedAt,
    };
  }
}