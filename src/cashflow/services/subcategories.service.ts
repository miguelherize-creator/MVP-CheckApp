import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateSubcategoryDto } from '../dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from '../dto/update-subcategory.dto';
import { Category } from '../entities/category.entity';
import { Subcategory } from '../entities/subcategory.entity';
import { slugify } from '../utils/slug';

@Injectable()
export class SubcategoriesService {
  constructor(
    @InjectRepository(Subcategory)
    private readonly repo: Repository<Subcategory>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async assertCategoryVisible(userId: string, categoryId: string): Promise<Category> {
    const cat = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!cat) {
      throw new NotFoundException('Categoría no encontrada');
    }
    if (cat.userId !== null && cat.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta categoría');
    }
    return cat;
  }

  async findAll(userId: string, categoryId?: string): Promise<Subcategory[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.category', 'c')
      .where('(s.user_id IS NULL OR s.user_id = :userId)', { userId })
      .andWhere('(c.user_id IS NULL OR c.user_id = :userId)', { userId });
    if (categoryId) {
      qb.andWhere('s.category_id = :categoryId', { categoryId });
    }
    qb.orderBy('s.sort_order', 'ASC').addOrderBy('s.name', 'ASC');
    return qb.getMany();
  }

  async findOne(userId: string, id: string): Promise<Subcategory> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!row) {
      throw new NotFoundException('Subcategoría no encontrada');
    }
    await this.assertCategoryVisible(userId, row.categoryId);
    if (row.userId !== null && row.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subcategoría');
    }
    return row;
  }

  async create(userId: string, dto: CreateSubcategoryDto): Promise<Subcategory> {
    await this.assertCategoryVisible(userId, dto.categoryId);
    let baseSlug = dto.slug?.trim() || slugify(dto.name);
    let slug = baseSlug;
    let n = 0;
    while (
      await this.repo.findOne({
        where: { categoryId: dto.categoryId, slug },
      })
    ) {
      n += 1;
      slug = `${baseSlug}_${n}`;
    }
    const row = this.repo.create({
      categoryId: dto.categoryId,
      userId,
      name: dto.name,
      slug,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateSubcategoryDto,
  ): Promise<Subcategory> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Subcategoría no encontrada');
    }
    if (row.isSystem && row.userId === null) {
      throw new ForbiddenException('No se puede editar el catálogo del sistema');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('No puedes editar esta subcategoría');
    }
    if (dto.categoryId && dto.categoryId !== row.categoryId) {
      await this.assertCategoryVisible(userId, dto.categoryId);
      row.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.slug !== undefined) {
      const taken = await this.repo.findOne({
        where: { categoryId: row.categoryId, slug: dto.slug },
      });
      if (taken && taken.id !== id) {
        throw new ConflictException('Slug duplicado en esta categoría');
      }
      row.slug = dto.slug;
    }
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Subcategoría no encontrada');
    }
    if (row.isSystem && row.userId === null) {
      throw new ForbiddenException('No se puede eliminar el catálogo del sistema');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('No puedes eliminar esta subcategoría');
    }
    await this.repo.delete({ id, userId });
  }
}
