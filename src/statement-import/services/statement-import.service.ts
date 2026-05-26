import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StatementImport, ImportStatus } from '../entities/statement-import.entity';
import { ImportLineItem, ImportLineReviewStatus } from '../entities/import-line-item.entity';
import { parseSantanderCartola, CartolaSantanderRow } from '../parsers/santander-cartola.parser';
import { ClassificationService, ClassifiedMovement } from '../../classification/services/classification.service';

@Injectable()
export class StatementImportService {
  private readonly logger = new Logger(StatementImportService.name);

  constructor(
    @InjectRepository(StatementImport)
    private readonly importRepo: Repository<StatementImport>,

    @InjectRepository(ImportLineItem)
    private readonly lineItemRepo: Repository<ImportLineItem>,

    private readonly classificationService: ClassificationService,
  ) {}

  // ─── Upload ──────────────────────────────────────────────────────────────────

  async uploadAndParse(
    userId: string,
    fileBuffer: Buffer,
    originalFilename: string,
  ): Promise<StatementImport> {
    if (!originalFilename.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Solo se aceptan archivos PDF (.pdf)');
    }

    const importRecord = this.importRepo.create({
      userId,
      fileKey: `uploads/${userId}/${Date.now()}.pdf`,
      originalFilename,
      status: ImportStatus.PENDING,
    });
    await this.importRepo.save(importRecord);

    this.processAsync(importRecord, fileBuffer).catch((err) => {
      this.logger.error(`Error procesando import ${importRecord.id}: ${err.message}`);
    });

    return importRecord;
  }

  // ─── Procesamiento asíncrono ──────────────────────────────────────────────────

  private async processAsync(importRecord: StatementImport, fileBuffer: Buffer): Promise<void> {
    try {
      await this.importRepo.update(importRecord.id, { status: ImportStatus.PROCESSING });

      // 1. Parsear PDF
      const { rows, header } = await parseSantanderCartola(fileBuffer);

      if (rows.length === 0) {
        throw new Error('No se encontraron movimientos en el PDF.');
      }

      // 2. Clasificar movimientos
      const rawMovements = rows.map((row, idx) => ({
        rowIndex: idx,
        date: row.date,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        movementType: row.movementType,
        docNumber: row.docNumber,
        branch: row.branch,
      }));

      const { classified, summary } = this.classificationService.classifyAll(rawMovements);

      // 3. Persistir líneas con clasificación
      await this.saveLineItems(importRecord.id, rows, classified);

      await this.importRepo.update(importRecord.id, {
        status: ImportStatus.PARSED,
        parsedAt: new Date(),
      });

      this.logger.log(
        `Import ${importRecord.id} OK — ${rows.length} movimientos | ` +
        `auto: ${summary.autoClassified} | pendientes: ${summary.pending} | ` +
        `hormigas: ${summary.antExpenses} | traspasos: ${summary.transfers}`,
      );
    } catch (err: any) {
      this.logger.error(`Import ${importRecord.id} falló: ${err.message}`);
      await this.importRepo.update(importRecord.id, {
        status: ImportStatus.FAILED,
        errorMessage: err.message,
      });
    }
  }

  // ─── Persistencia ─────────────────────────────────────────────────────────────

  private async saveLineItems(
    importId: string,
    rows: CartolaSantanderRow[],
    classified: ClassifiedMovement[],
  ): Promise<void> {
    const CHUNK = 100;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const entities = chunk.map((row, idx) => {
        const cl = classified[i + idx];
        return this.lineItemRepo.create({
          importId,
          rowIndex: i + idx,
          rawRow: row,
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
          },
          userReviewStatus: ImportLineReviewStatus.PENDING,
        });
      });
      await this.lineItemRepo.save(entities);
    }
  }

  // ─── Reclasificación manual ────────────────────────────────────────────────────

  async reclassifyLine(
    importId: string,
    lineId: string,
    userId: string,
    category: string,
    subcategory: string,
  ): Promise<ImportLineItem> {
    await this.findOneByUser(importId, userId);

    const line = await this.lineItemRepo.findOne({ where: { id: lineId, importId } });
    if (!line) throw new NotFoundException('Línea no encontrada');

    const current = line.normalized as any;
    const reclassified = this.classificationService.reclassify(
      { ...current, rowIndex: line.rowIndex, debit: current.amount },
      category,
      subcategory,
    );

    line.normalized = {
      ...current,
      category: reclassified.category,
      subcategory: reclassified.subcategory,
      isAntExpense: reclassified.isAntExpense,
      classificationStatus: 'manual',
      ruleMatched: 'manual',
    };
    line.userReviewStatus = ImportLineReviewStatus.EDITED;

    return this.lineItemRepo.save(line);
  }

  // ─── Consultas ────────────────────────────────────────────────────────────────

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
    return this.lineItemRepo.find({ where: { importId }, order: { rowIndex: 'ASC' } });
  }

  async getPendingLines(importId: string, userId: string): Promise<ImportLineItem[]> {
    await this.findOneByUser(importId, userId);
    return this.lineItemRepo.find({
      where: { importId, userReviewStatus: ImportLineReviewStatus.PENDING },
      order: { rowIndex: 'ASC' },
    });
  }

  async cancelImport(importId: string, userId: string): Promise<StatementImport> {
    const record = await this.findOneByUser(importId, userId);
    if (record.status === ImportStatus.PARSED) {
      throw new BadRequestException('No se puede cancelar un import ya procesado');
    }
    await this.importRepo.update(importId, { status: ImportStatus.CANCELLED });
    return { ...record, status: ImportStatus.CANCELLED };
  }
}
