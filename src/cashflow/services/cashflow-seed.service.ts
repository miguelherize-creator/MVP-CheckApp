import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { IsNull, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FundingSourceKind } from '../enums/funding-source-kind.enum';
import { FundingSource } from '../entities/funding-source.entity';
import { Category } from '../entities/category.entity';
import { Subcategory } from '../entities/subcategory.entity';
import { slugify } from '../utils/slug';

type CategorySeedFile = Record<string, string[]>;

type FundingSeedRow = {
  code: string;
  name: string;
  type: FundingSourceKind;
};

@Injectable()
export class CashflowSeedService implements OnModuleInit {
  private readonly logger = new Logger(CashflowSeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepo: Repository<Subcategory>,
    @InjectRepository(FundingSource)
    private readonly fundingRepo: Repository<FundingSource>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    const run = this.config.get<string>('SEED_CASHFLOW', 'false') === 'true';
    if (!run) {
      return;
    }
    this.logger.log('SEED_CASHFLOW=true — sembrando catálogo y orígenes por usuario');
    await this.seedCategoriesAndSubcategories();
    await this.seedFundingSourcesForAllUsers();
  }

  private dataDir(): string {
    return path.join(__dirname, '..', 'data');
  }

  async seedCategoriesAndSubcategories(): Promise<void> {
    const filePath = path.join(this.dataDir(), 'category.seed.json');
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`No se encontró ${filePath}`);
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as CategorySeedFile;
    let catOrder = 0;
    for (const [catName, subs] of Object.entries(data)) {
      const slug = slugify(catName);
      let cat = await this.categoryRepo.findOne({
        where: { userId: IsNull(), slug },
      });
      if (!cat) {
        cat = await this.categoryRepo.save(
          this.categoryRepo.create({
            userId: null,
            parentId: null,
            name: catName,
            slug,
            sortOrder: catOrder++,
            isSystem: true,
            isActive: true,
          }),
        );
        this.logger.log(`Categoría creada: ${catName}`);
      }
      let subOrder = 0;
      const usedSlugs = new Set<string>();
      for (const subName of subs) {
        let subSlug = slugify(subName);
        let n = 0;
        while (usedSlugs.has(subSlug)) {
          n += 1;
          subSlug = `${slugify(subName)}_${n}`;
        }
        usedSlugs.add(subSlug);
        const exists = await this.subcategoryRepo.findOne({
          where: { categoryId: cat.id, slug: subSlug },
        });
        if (exists) {
          continue;
        }
        await this.subcategoryRepo.save(
          this.subcategoryRepo.create({
            categoryId: cat.id,
            userId: null,
            name: subName,
            slug: subSlug,
            sortOrder: subOrder++,
            isSystem: true,
            isActive: true,
          }),
        );
      }
    }
  }

  async seedFundingSourcesForAllUsers(): Promise<void> {
    const filePath = path.join(this.dataDir(), 'funding-sources.seed.json');
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`No se encontró ${filePath}`);
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = JSON.parse(raw) as FundingSeedRow[];
    const users = await this.userRepo.find({ select: ['userId'] });
    for (const u of users) {
      await this.ensureFundingSourcesForUser(u.userId, rows);
    }
  }

  async ensureFundingSourcesForUser(
    userId: string,
    rows?: FundingSeedRow[],
  ): Promise<void> {
    const filePath = path.join(this.dataDir(), 'funding-sources.seed.json');
    const list =
      rows ??
      (JSON.parse(
        fs.readFileSync(filePath, 'utf8'),
      ) as FundingSeedRow[]);
    for (const row of list) {
      const exists = await this.fundingRepo.findOne({
        where: { userId, code: row.code },
      });
      if (exists) {
        continue;
      }
      await this.fundingRepo.save(
        this.fundingRepo.create({
          userId,
          code: row.code,
          name: row.name,
          type: row.type,
          isActive: true,
          metadata: {},
        }),
      );
      this.logger.log(`Origen ${row.code} creado para usuario ${userId}`);
    }
  }
}
