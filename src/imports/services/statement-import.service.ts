import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatementImport } from '../entities/statement-import.entity';
import { ImportLineItem } from '../entities/import-line-item.entity';
import { parseSantanderCartola, CartolaSantanderRow } from '../parsers/santander-cartola.parser';
import { ClassificationService, ClassifiedMovement } from './classification.service';

@Injectable()
export class StatementImportService {
  private readonly logger = new Logger(StatementImportService.name);

  constructor(
    @InjectRepository(StatementImport)
    private readonly importRepo: Repository<StatementImport>,
    @InjectRepository(ImportLineItem)
    private readonly lineRepo: Repository<ImportLineItem>,
    private readonly classificationService: ClassificationService,
  ) {}

  async uploadAndParse(userId: string, fileBuffer: Buffer, originalFilename: string): Promise<StatementImport> {
    if (!originalFilename.toLowerCase().endsWith('.pdf'))
      throw new BadRequestException('Solo se aceptan archivos PDF');

    const record = this.importRepo.create({
      userId,
      fileKey: `uploads/${userId}/${Date.now()}.pdf`,
      originalFilename,
      status: 'pending',
    });
    await this.importRepo.save(record);

    this.processAsync(record, fileBuffer).catch(err =>
      this.logger.error(`Error import ${record.id}: ${err.message}`),
    );

    return record;
  }

  private async processAsync(record: StatementImport, fileBuffer: Buffer): Promise<void> {
    try {
      await this.importRepo.update(record.id, { status: 'processing' });

      const { rows, header } = await parseSantanderCartola(fileBuffer);
      if (rows.length === 0) throw new Error('No se encontraron movimientos en el PDF');

      const rawMovements = rows.map((row, idx) => ({
        rowIndex: idx,
        date: row.date,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        movementType: row.movementType,
      }));

      const classified = this.classificationService.classifyAll(rawMovements);
      await this.saveLineItems(record.id, rows, classified);

      await this.importRepo.update(record.id, { status: 'parsed', parsedAt: new Date() });

      this.logger.log(`Import ${record.id} OK — ${rows.length} movimientos | cuenta ${header.accountNumber}`);
    } catch (err: any) {
      this.logger.error(`Import ${record.id} falló: ${err.message}`);
      await this.importRepo.update(record.id, { status: 'failed', errorMessage: err.message });
    }
  }

  private async saveLineItems(importId: string, rows: CartolaSantanderRow[], classified: ClassifiedMovement[]): Promise<void> {
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const entities = chunk.map((row, idx) => {
        const cl = classified[i + idx];
        return this.lineRepo.create({
          importId,
          rowIndex: i + idx,
          rawRow: row as any,
          normalized: {
            occurredOn: row.date,
            amount: row.debit ?? row.credit,
            movementType: cl.movementType,
            flowType: cl.flowType,
            description: row.description,
            category: cl.category,
            subcategory: cl.subcategory,
            isTransfer: cl.isTransfer,
            isAntExpense: cl.isAntExpense,
            classificationStatus: cl.classificationStatus,
            ruleMatched: cl.ruleMatched,
            docNumber: row.docNumber,
            balance: row.balance,
            branch: row.branch,
            currency: 'CLP',
          } as any,
          userReviewStatus: 'pending',
        });
      });
      await this.lineRepo.save(entities);
    }
  }

  async findAllByUser(userId: string): Promise<StatementImport[]> {
    return this.importRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findOneByUser(importId: string, userId: string): Promise<StatementImport> {
    const record = await this.importRepo.findOne({ where: { id: importId, userId } });
    if (!record) throw new NotFoundException('Import no encontrado');
    return record;
  }

  async getLineItems(importId: string, userId: string): Promise<ImportLineItem[]> {
    await this.findOneByUser(importId, userId);
    return this.lineRepo.find({ where: { importId }, order: { rowIndex: 'ASC' } });
  }

  async getPendingLines(importId: string, userId: string): Promise<ImportLineItem[]> {
    await this.findOneByUser(importId, userId);
    return this.lineRepo.find({ where: { importId, userReviewStatus: 'pending' }, order: { rowIndex: 'ASC' } });
  }

  async reclassifyLine(importId: string, lineId: string, userId: string, category: string, subcategory: string): Promise<ImportLineItem> {
    await this.findOneByUser(importId, userId);
    const line = await this.lineRepo.findOne({ where: { id: lineId, importId } });
    if (!line) throw new NotFoundException('Línea no encontrada');

    const current = line.normalized as any;
    const reclassified = this.classificationService.reclassify(
      { ...current, rowIndex: line.rowIndex ?? 0, debit: current.amount },
      category,
      subcategory,
    );

    line.normalized = { ...current, category: reclassified.category, subcategory: reclassified.subcategory, isAntExpense: reclassified.isAntExpense, classificationStatus: 'manual', ruleMatched: 'manual' } as any;
    line.userReviewStatus = 'edited';
    return this.lineRepo.save(line);
  }

  async cancelImport(importId: string, userId: string): Promise<StatementImport> {
    const record = await this.findOneByUser(importId, userId);
    if (record.status === 'parsed') throw new BadRequestException('No se puede cancelar un import ya procesado');
    await this.importRepo.update(importId, { status: 'cancelled' });
    return { ...record, status: 'cancelled' };
  }
}
