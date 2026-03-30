import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFundingSourceDto } from '../dto/create-funding-source.dto';
import { UpdateFundingSourceDto } from '../dto/update-funding-source.dto';
import { FundingSource } from '../entities/funding-source.entity';

@Injectable()
export class FundingSourcesService {
  constructor(
    @InjectRepository(FundingSource)
    private readonly repo: Repository<FundingSource>,
  ) {}

  async findAll(userId: string): Promise<FundingSource[]> {
    return this.repo.find({
      where: { userId },
      order: { code: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<FundingSource> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Origen de fondos no encontrado');
    }
    return row;
  }

  async create(userId: string, dto: CreateFundingSourceDto): Promise<FundingSource> {
    const exists = await this.repo.findOne({
      where: { userId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException('Ya existe un origen con ese código');
    }
    const row = this.repo.create({
      userId,
      code: dto.code,
      name: dto.name,
      type: dto.type,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? {},
    });
    return this.repo.save(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFundingSourceDto,
  ): Promise<FundingSource> {
    const row = await this.findOne(userId, id);
    if (dto.code !== undefined && dto.code !== row.code) {
      const taken = await this.repo.findOne({
        where: { userId, code: dto.code },
      });
      if (taken) {
        throw new ConflictException('Ya existe un origen con ese código');
      }
      row.code = dto.code;
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.type !== undefined) row.type = dto.type;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.repo.delete({ id, userId });
    if (!res.affected) {
      throw new NotFoundException('Origen de fondos no encontrado');
    }
  }
}
