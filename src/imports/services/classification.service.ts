import { Injectable, Logger } from '@nestjs/common';
import {
  CLASSIFICATION_RULES,
  ClassificationRule,
  ANT_EXPENSE_MAX_AMOUNT,
  ANT_EXPENSE_EXCLUDED_SUBCATEGORIES,
} from '../data/classification-rules.data';

export interface RawMovement {
  rowIndex: number;
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  movementType: 'income' | 'expense';
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

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);
  private readonly rules: ClassificationRule[] = [...CLASSIFICATION_RULES].sort((a, b) => b.priority - a.priority);

  classifyAll(movements: RawMovement[]): ClassifiedMovement[] {
    const classified = movements.map(m => this.classifyOne(m));
    this.applyFlowType(classified);
    this.applyAntExpense(classified);
    const auto = classified.filter(c => c.classificationStatus === 'auto').length;
    const pending = classified.filter(c => c.classificationStatus === 'pending').length;
    const ants = classified.filter(c => c.isAntExpense).length;
    this.logger.log(`Clasificación: ${auto} auto | ${pending} pendientes | ${ants} hormigas`);
    return classified;
  }

  private classifyOne(m: RawMovement): ClassifiedMovement {
    const desc = m.description.toLowerCase();
    for (const rule of this.rules) {
      if (rule.keywords.some(kw => desc.includes(kw.toLowerCase()))) {
        return {
          ...m,
          category: rule.category,
          subcategory: rule.subcategory,
          isTransfer: rule.isTransfer ?? false,
          isAntExpense: false,
          flowType: 'variable',
          classificationStatus: 'auto',
          ruleMatched: rule.keywords[0],
        };
      }
    }
    return {
      ...m,
      category: 'Categorizar',
      subcategory: 'Categorizar',
      isTransfer: false,
      isAntExpense: false,
      flowType: 'variable',
      classificationStatus: 'pending',
      ruleMatched: null,
    };
  }

  private applyFlowType(movements: ClassifiedMovement[]): void {
    const counts = new Map<string, number>();
    for (const m of movements) {
      const key = m.description.toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const m of movements) {
      m.flowType = (counts.get(m.description.toLowerCase().trim()) ?? 1) > 1 ? 'fixed' : 'variable';
    }
  }

  private applyAntExpense(movements: ClassifiedMovement[]): void {
    for (const m of movements) {
      if (m.movementType !== 'expense' || m.isTransfer) continue;
      const amount = m.debit ?? 0;
      if (amount <= 0 || amount > ANT_EXPENSE_MAX_AMOUNT) continue;
      if (ANT_EXPENSE_EXCLUDED_SUBCATEGORIES.includes(m.subcategory)) continue;
      m.isAntExpense = true;
    }
  }

  reclassify(movement: ClassifiedMovement, newCategory: string, newSubcategory: string): ClassifiedMovement {
    const updated = { ...movement, category: newCategory, subcategory: newSubcategory, classificationStatus: 'auto' as const, ruleMatched: 'manual' };
    updated.isAntExpense = false;
    if (
      updated.movementType === 'expense' && !updated.isTransfer &&
      (updated.debit ?? 0) <= ANT_EXPENSE_MAX_AMOUNT &&
      !ANT_EXPENSE_EXCLUDED_SUBCATEGORIES.includes(newSubcategory)
    ) {
      updated.isAntExpense = true;
    }
    return updated;
  }
}
