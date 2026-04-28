import { Injectable, Logger } from '@nestjs/common';
import {
  CLASSIFICATION_RULES,
  ClassificationRule,
  ANT_EXPENSE_MAX_AMOUNT,
  ANT_EXPENSE_EXCLUDED_SUBCATEGORIES,
} from '../data/classification-rules.data';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RawMovement {
  rowIndex: number;
  date: string;           // YYYY-MM-DD
  description: string;   // glosa bancaria original
  debit: number | null;
  credit: number | null;
  movementType: 'income' | 'expense';
  docNumber?: string;
  branch?: string;
}

export interface ClassifiedMovement extends RawMovement {
  category: string;
  subcategory: string;
  isTransfer: boolean;
  isAntExpense: boolean;
  flowType: 'fixed' | 'variable';
  classificationStatus: 'auto' | 'pending';
  ruleMatched: string | null;
}

export interface ClassificationSummary {
  total: number;
  autoClassified: number;
  pending: number;
  transfers: number;
  antExpenses: number;
  byCategory: Record<string, number>;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  // Reglas ordenadas por prioridad descendente (mayor prioridad primero)
  private readonly rules: ClassificationRule[] = [...CLASSIFICATION_RULES].sort(
    (a, b) => b.priority - a.priority,
  );

  // ─── Entry point ─────────────────────────────────────────────────────────

  /**
   * Clasifica una lista de movimientos aplicando:
   * 1. Reglas de keyword por glosa bancaria
   * 2. Detección de traspasos entre cuentas
   * 3. Clasificación fijo/variable por recurrencia de glosa
   * 4. Detección de gastos hormiga
   *
   * Los movimientos sin match quedan en status 'pending' con
   * categoría "Categorizar" para revisión manual del usuario.
   */
  classifyAll(movements: RawMovement[]): {
    classified: ClassifiedMovement[];
    summary: ClassificationSummary;
  } {
    // Paso 1 — Clasificar cada movimiento por reglas de keyword
    const classified = movements.map((m) => this.classifyOne(m));

    // Paso 2 — Detectar tipo de movimiento fijo/variable por recurrencia de glosa
    this.applyFlowType(classified);

    // Paso 3 — Detectar gastos hormiga en el set completo
    this.applyAntExpense(classified);

    // Paso 4 — Generar resumen
    const summary = this.buildSummary(classified);

    this.logger.log(
      `Clasificación completada: ${summary.autoClassified} auto / ${summary.pending} pendientes / ${summary.antExpenses} hormigas`,
    );

    return { classified, summary };
  }

  // ─── Clasificación individual ─────────────────────────────────────────────

  private classifyOne(movement: RawMovement): ClassifiedMovement {
    const desc = movement.description.toLowerCase();

    // Recorrer reglas en orden de prioridad
    for (const rule of this.rules) {
      const matched = rule.keywords.some((kw) =>
        desc.includes(kw.toLowerCase()),
      );

      if (matched) {
        return {
          ...movement,
          category: rule.category,
          subcategory: rule.subcategory,
          isTransfer: rule.isTransfer ?? false,
          isAntExpense: false, // se calcula después
          flowType: 'variable', // se calcula después
          classificationStatus: 'auto',
          ruleMatched: rule.keywords[0],
        };
      }
    }

    // Sin match → pendiente de revisión manual
    return {
      ...movement,
      category: 'Categorizar',
      subcategory: 'Categorizar',
      isTransfer: false,
      isAntExpense: false,
      flowType: 'variable',
      classificationStatus: 'pending',
      ruleMatched: null,
    };
  }

  // ─── Tipo de movimiento: Fijo / Variable ──────────────────────────────────

  /**
   * Regla del Excel: si la glosa se repite más de una vez en el set → Fijo.
   * Aplicado sobre la descripción normalizada (lowercase, sin espacios extra).
   */
  private applyFlowType(movements: ClassifiedMovement[]): void {
    const descCount = new Map<string, number>();

    for (const m of movements) {
      const key = m.description.toLowerCase().trim();
      descCount.set(key, (descCount.get(key) ?? 0) + 1);
    }

    for (const m of movements) {
      const key = m.description.toLowerCase().trim();
      const count = descCount.get(key) ?? 1;
      m.flowType = count > 1 ? 'fixed' : 'variable';
    }
  }

  // ─── Detección de gastos hormiga ──────────────────────────────────────────

  /**
   * Regla del Excel:
   * - Es egreso
   * - Monto ≤ $16.000
   * - No es traspaso entre cuentas
   * - Subcategoría no está en la lista de exclusión
   */
  private applyAntExpense(movements: ClassifiedMovement[]): void {
    for (const m of movements) {
      if (m.movementType !== 'expense') continue;
      if (m.isTransfer) continue;

      const amount = m.debit ?? 0;
      if (amount <= 0 || amount > ANT_EXPENSE_MAX_AMOUNT) continue;

      if (ANT_EXPENSE_EXCLUDED_SUBCATEGORIES.includes(m.subcategory)) continue;

      m.isAntExpense = true;
    }
  }

  // ─── Resumen ──────────────────────────────────────────────────────────────

  private buildSummary(movements: ClassifiedMovement[]): ClassificationSummary {
    const byCategory: Record<string, number> = {};

    for (const m of movements) {
      byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    }

    return {
      total: movements.length,
      autoClassified: movements.filter((m) => m.classificationStatus === 'auto').length,
      pending: movements.filter((m) => m.classificationStatus === 'pending').length,
      transfers: movements.filter((m) => m.isTransfer).length,
      antExpenses: movements.filter((m) => m.isAntExpense).length,
      byCategory,
    };
  }

  // ─── Reclasificación manual ───────────────────────────────────────────────

  /**
   * Reclasifica un movimiento individual cuando el usuario lo corrige manualmente.
   * Devuelve el movimiento actualizado — el servicio llamador lo persiste.
   */
  reclassify(
    movement: ClassifiedMovement,
    newCategory: string,
    newSubcategory: string,
  ): ClassifiedMovement {
    const updated: ClassifiedMovement = {
      ...movement,
      category: newCategory,
      subcategory: newSubcategory,
      classificationStatus: 'auto', // ya revisado por el usuario
      ruleMatched: 'manual',
    };

    // Recalcular gasto hormiga con la nueva subcategoría
    updated.isAntExpense = false;
    if (
      updated.movementType === 'expense' &&
      !updated.isTransfer &&
      (updated.debit ?? 0) <= ANT_EXPENSE_MAX_AMOUNT &&
      !ANT_EXPENSE_EXCLUDED_SUBCATEGORIES.includes(newSubcategory)
    ) {
      updated.isAntExpense = true;
    }

    return updated;
  }
}
