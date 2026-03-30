import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';
import { slugify } from '../utils/slug';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  /** Catálogo global (user_id null) + categorías propias del usuario */
  async findAll(userId: string): Promise<Category[]> {
    return this.repo.find({
      where: [{ userId: IsNull() }, { userId }],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Category> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Categoría no encontrada');
    }
    if (row.userId !== null && row.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta categoría');
    }
    return row;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const slug =
      dto.slug?.trim() || slugify(dto.name);
    const exists = await this.repo.findOne({
      where: { userId, slug },
    });
    if (exists) {
      throw new ConflictException('Ya existe una categoría con ese slug');
    }
    if (dto.parentId) {
      await this.findOne(userId, dto.parentId);
    }
    const row = this.repo.create({
      userId,
      name: dto.name,
      slug,
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Categoría no encontrada');
    }
    if (row.isSystem && row.userId === null) {
      throw new ForbiddenException('No se puede editar el catálogo del sistema');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('No puedes editar esta categoría');
    }
    if (dto.slug !== undefined && dto.slug !== row.slug) {
      const taken = await this.repo.findOne({
        where: { userId, slug: dto.slug },
      });
      if (taken && taken.id !== id) {
        throw new ConflictException('Ya existe una categoría con ese slug');
      }
      row.slug = dto.slug;
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.parentId !== undefined) row.parentId = dto.parentId;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Categoría no encontrada');
    }
    if (row.isSystem && row.userId === null) {
      throw new ForbiddenException('No se puede eliminar el catálogo del sistema');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta categoría');
    }
    await this.repo.delete({ id, userId });
  }
}
