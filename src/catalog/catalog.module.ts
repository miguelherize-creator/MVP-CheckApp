import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogSeedService } from './catalog-seed.service';
import { Country } from './entities/country.entity';
import { Currency } from './entities/currency.entity';
import { DocumentType } from './entities/document-type.entity';
import { StatusDomain } from './entities/status-domain.entity';
import { Status } from './entities/status.entity';
import { Role } from './entities/role.entity';
import { FinancialHealthLevel } from './entities/financial-health-level.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Country, Currency, DocumentType, StatusDomain, Status, Role, FinancialHealthLevel]),
  ],
  providers: [CatalogSeedService],
  exports: [CatalogSeedService],
})
export class CatalogModule {}
