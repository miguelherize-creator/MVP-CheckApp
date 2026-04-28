import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { StatementImport } from './entities/statement-import.entity';
import { ImportLineItem } from './entities/import-line-item.entity';
import { StatementImportService } from './services/statement-import.service';
import { StatementImportController } from './controllers/statement-import.controller';
import { ClassificationService } from '../classification/services/classification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StatementImport, ImportLineItem]),
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [StatementImportController],
  providers: [StatementImportService, ClassificationService],
  exports: [StatementImportService, ClassificationService],
})
export class StatementImportModule {}
