import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { Category } from '../entities/category.entity';
import { FundingSource } from '../entities/funding-source.entity';
import { Subcategory } from '../entities/subcategory.entity';
import { Transaction } from '../entities/transaction.entity';
import { CategorizationStatus } from '../enums/categorization-status.enum';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    @InjectRepository(FundingSource)
    private readonly fundingRepo: Repository<FundingSource>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepo: Repository<Subcategory>,
  ) {}

  private async assertCategory(userId: string, id: string | null | undefined) {
    if (!id) return;
    const c = await this.categoryRepo.findOne({ where: { id } });
    if (!c) throw new BadRequestException('Categoría inválida');
    if (c.userId !== null && c.userId !== userId) {
      throw new BadRequestException('Categoría no disponible');
    }
  }

  private async assertSubcategory(
    userId: string,
    id: string | null | undefined,
  ) {
    if (!id) return;
    const s = await this.subcategoryRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!s) throw new BadRequestException('Subcategoría inválida');
    const catOk =
      s.category.userId === null || s.category.userId === userId;
    const subOk = s.userId === null || s.userId === userId;
    if (!catOk || !subOk) {
      throw new BadRequestException('Subcategoría no disponible');
    }
  }

  private async assertFundingSource(userId: string, id: string | null | undefined) {
    if (!id) return;
    const f = await this.fundingRepo.findOne({ where: { id, userId } });
    if (!f) {
      throw new BadRequestException('Origen de fondos inválido');
    }
  }

  async findAll(userId: string): Promise<Transaction[]> {
    return this.repo.find({
      where: { userId },
      order: { occurredOn: 'DESC', createdAt: 'DESC' },
      relations: ['fundingSource', 'destinationFundingSource', 'category', 'subcategory'],
    });
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const row = await this.repo.findOne({
      where: { id, userId },
      relations: ['fundingSource', 'destinationFundingSource', 'category', 'subcategory'],
    });
    if (!row) {
      throw new NotFoundException('Movimiento no encontrado');
    }
    return row;
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    await this.assertFundingSource(userId, dto.fundingSourceId);
    await this.assertFundingSource(userId, dto.destinationFundingSourceId);
    await this.assertCategory(userId, dto.categoryId);
    await this.assertSubcategory(userId, dto.subcategoryId);
    if (dto.categoryId && dto.subcategoryId) {
      const sub = await this.subcategoryRepo.findOne({
        where: { id: dto.subcategoryId },
      });
      if (sub && sub.categoryId !== dto.categoryId) {
        throw new BadRequestException(
          'La subcategoría no corresponde a la categoría indicada',
        );
      }
    }
    const row = this.repo.create({
      userId,
      movementType: dto.movementType,
      flowType: dto.flowType,
      fundingSourceId: dto.fundingSourceId ?? null,
      destinationFundingSourceId: dto.destinationFundingSourceId ?? null,
      categoryId: dto.categoryId ?? null,
      subcategoryId: dto.subcategoryId ?? null,
      amount: String(dto.amount),
      occurredOn: dto.occurredOn.slice(0, 10),
      bankDescription: dto.bankDescription ?? null,
      description: dto.description ?? null,
      categorizationStatus: dto.categorizationStatus ?? CategorizationStatus.CATEGORIZED,
      isAntExpense: dto.isAntExpense ?? false,
      externalRef: dto.externalRef ?? null,
      deletedAt: null,
    });
    return this.repo.save(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const row = await this.findOne(userId, id);
    const nextCat = dto.categoryId !== undefined ? dto.categoryId : row.categoryId;
    const nextSub = dto.subcategoryId !== undefined ? dto.subcategoryId : row.subcategoryId;
    if (nextCat && nextSub) {
      const sub = await this.subcategoryRepo.findOne({
        where: { id: nextSub },
      });
      if (sub && sub.categoryId !== nextCat) {
        throw new BadRequestException(
          'La subcategoría no corresponde a la categoría indicada',
        );
      }
    }
    if (dto.fundingSourceId !== undefined) {
      await this.assertFundingSource(userId, dto.fundingSourceId ?? undefined);
      row.fundingSourceId = dto.fundingSourceId;
    }
    if (dto.destinationFundingSourceId !== undefined) {
      await this.assertFundingSource(userId, dto.destinationFundingSourceId ?? undefined);
      row.destinationFundingSourceId = dto.destinationFundingSourceId;
    }
    if (dto.categoryId !== undefined) {
      await this.assertCategory(userId, dto.categoryId ?? undefined);
      row.categoryId = dto.categoryId;
    }
    if (dto.subcategoryId !== undefined) {
      await this.assertSubcategory(userId, dto.subcategoryId ?? undefined);
      row.subcategoryId = dto.subcategoryId;
    }
    if (dto.movementType !== undefined) row.movementType = dto.movementType;
    if (dto.flowType !== undefined) row.flowType = dto.flowType;
    if (dto.amount !== undefined) row.amount = String(dto.amount);
    if (dto.occurredOn !== undefined) {
      row.occurredOn = dto.occurredOn.slice(0, 10);
    }
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.categorizationStatus !== undefined) row.categorizationStatus = dto.categorizationStatus;
    if (dto.isAntExpense !== undefined) row.isAntExpense = dto.isAntExpense;
    if (dto.externalRef !== undefined) row.externalRef = dto.externalRef;
    return this.repo.save(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.repo.delete({ id, userId });
    if (!res.affected) {
      throw new NotFoundException('Movimiento no encontrado');
    }
  }
}
