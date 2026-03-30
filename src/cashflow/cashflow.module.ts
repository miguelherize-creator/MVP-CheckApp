import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { FundingSource } from './entities/funding-source.entity';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { Transaction } from './entities/transaction.entity';
import { FundingSourcesService } from './services/funding-sources.service';
import { CategoriesService } from './services/categories.service';
import { SubcategoriesService } from './services/subcategories.service';
import { TransactionsService } from './services/transactions.service';
import { CashflowSeedService } from './services/cashflow-seed.service';
import { FundingSourcesController } from './controllers/funding-sources.controller';
import { CategoriesController } from './controllers/categories.controller';
import { SubcategoriesController } from './controllers/subcategories.controller';
import { TransactionsController } from './controllers/transactions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      FundingSource,
      Category,
      Subcategory,
      Transaction,
    ]),
  ],
  controllers: [
    FundingSourcesController,
    CategoriesController,
    SubcategoriesController,
    TransactionsController,
  ],
  providers: [
    FundingSourcesService,
    CategoriesService,
    SubcategoriesService,
    TransactionsService,
    CashflowSeedService,
  ],
  exports: [CashflowSeedService],
})
export class CashflowModule {}
