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
    email: string;
    password: string;
    name: string;
    acceptedTermsAt?: Date | null;
  }): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con este correo');
    }
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      acceptedTermsAt: data.acceptedTermsAt ?? null,
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

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase() })
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
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const taken = await this.usersRepo.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (taken) {
        throw new ConflictException('El correo ya está en uso');
      }
      user.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    return this.usersRepo.save(user);
  }

  toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
