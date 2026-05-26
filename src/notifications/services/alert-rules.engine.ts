import { Injectable, Logger } from '@nestjs/common';

export enum AlertType {
  // Mis pagos
  BILL_DUE_SOON             = 'bill_due_soon',
  BILL_OVERDUE              = 'bill_overdue',
  // Mi presupuesto
  BUDGET_OVERRUN            = 'budget_overrun',
  NEGATIVE_SAVINGS_CAPACITY = 'negative_savings_capacity',
  CREDIT_PRESSURE           = 'credit_pressure',
  // Financieras
  ANT_EXPENSE_INCREASE      = 'ant_expense_increase',
  ANT_EXPENSE_DECREASE      = 'ant_expense_decrease',
  RECURRING_CHARGE_DETECTED = 'recurring_charge_detected',
  RECOVERABLE_SAVINGS       = 'recoverable_savings',
  // Calidad de datos
  UNCATEGORIZED_MOVEMENTS   = 'uncategorized_movements',
  // Mensajes periódicos
  WEEKLY_UPDATE             = 'weekly_update',
  DAILY_RECOMMENDATIONS     = 'daily_recommendations',
}

// Catálogo de secciones para la pantalla "Mis Avisos"
export interface AlertCatalogItem {
  alertType: AlertType;
  label: string;
  description: string;
  defaultEnabled: boolean;
  defaultCadenceDays: number;
  section: 'mis_pagos' | 'mi_presupuesto' | 'mensajes';
}

export const ALERT_CATALOG: AlertCatalogItem[] = [
  // ── Mis pagos ─────────────────────────────────────────────────────────────
  {
    alertType: AlertType.BILL_DUE_SOON,
    label: 'Vencimiento de pagos',
    description: 'Avisos próximos a la fecha de pago para evitar atrasos.',
    defaultEnabled: true,
    defaultCadenceDays: 1,
    section: 'mis_pagos',
  },
  {
    alertType: AlertType.BILL_OVERDUE,
    label: 'Pagos vencidos',
    description: 'Alertas cuando un pago ya venció sin ser pagado.',
    defaultEnabled: true,
    defaultCadenceDays: 1,
    section: 'mis_pagos',
  },
  // ── Mi presupuesto ────────────────────────────────────────────────────────
  {
    alertType: AlertType.BUDGET_OVERRUN,
    label: 'Umbrales de presupuesto',
    description: 'Cuando se cruzan límites de gasto por categoría.',
    defaultEnabled: true,
    defaultCadenceDays: 7,
    section: 'mi_presupuesto',
  },
  {
    alertType: AlertType.NEGATIVE_SAVINGS_CAPACITY,
    label: 'Capacidad de ahorro negativa',
    description: 'Cuando tus gastos superan tus ingresos del período.',
    defaultEnabled: true,
    defaultCadenceDays: 7,
    section: 'mi_presupuesto',
  },
  {
    alertType: AlertType.CREDIT_PRESSURE,
    label: 'Presión del crédito',
    description: 'Cuando los créditos absorben una parte importante de tu flujo.',
    defaultEnabled: true,
    defaultCadenceDays: 30,
    section: 'mi_presupuesto',
  },
  // ── Mensajes ──────────────────────────────────────────────────────────────
  {
    alertType: AlertType.WEEKLY_UPDATE,
    label: 'Actualización semanal',
    description: 'Recordatorio para importar últimos movimientos o cartolas y mantener el diagnóstico al día.',
    defaultEnabled: false,
    defaultCadenceDays: 7,
    section: 'mensajes',
  },
  {
    alertType: AlertType.DAILY_RECOMMENDATIONS,
    label: 'Recomendaciones diarias',
    description: 'Nuestra IA te hará recomendaciones diarias para que mantengas la calma financiera.',
    defaultEnabled: true,
    defaultCadenceDays: 1,
    section: 'mensajes',
  },
];

// ─── Contexto financiero ──────────────────────────────────────────────────────

export interface AlertContext {
  totalIncome: number;
  totalExpenses: number;
  totalExpensesWithoutCredit?: number;
  antExpensesCurrentMonth: number;
  antExpensesPreviousMonth: number;
  uncategorizedCount: number;
  recurringChargesDetected: string[];
  budgetOverrunCategories: string[];
  billsDueSoon: { title: string; dueDate: string }[];
  billsOverdue: { title: string; dueDate: string }[];
  period: string; // 'YYYY-MM'
}

export interface TriggeredAlert {
  alertType: AlertType;
  title: string;
  message: string;
  context: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
}

// ─── Motor de reglas ──────────────────────────────────────────────────────────

@Injectable()
export class AlertRulesEngine {
  private readonly logger = new Logger(AlertRulesEngine.name);

  evaluate(ctx: AlertContext): TriggeredAlert[] {
    const alerts: TriggeredAlert[] = [];

    this.checkSavingsCapacity(ctx, alerts);
    this.checkAntExpenses(ctx, alerts);
    this.checkBudgetOverrun(ctx, alerts);
    this.checkCreditPressure(ctx, alerts);
    this.checkRecurringCharges(ctx, alerts);
    this.checkUncategorized(ctx, alerts);
    this.checkBillsDue(ctx, alerts);
    this.checkRecoverableSavings(ctx, alerts);

    this.logger.log(`${alerts.length} alertas activadas para periodo ${ctx.period}`);
    return alerts;
  }

  private checkSavingsCapacity(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    const savings = ctx.totalIncome - ctx.totalExpenses;
    if (savings < 0) {
      alerts.push({
        alertType: AlertType.NEGATIVE_SAVINGS_CAPACITY,
        title: 'Tu capacidad de ahorro es negativa',
        message: `Este mes gastaste $${Math.abs(savings).toLocaleString('es-CL')} más de lo que ingresaste. Revisa qué egresos están presionando tu flujo.`,
        context: { savings, income: ctx.totalIncome, expenses: ctx.totalExpenses, period: ctx.period },
        priority: 'high',
      });
    }
  }

  private checkAntExpenses(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    if (ctx.antExpensesPreviousMonth === 0) return;
    const variation = (ctx.antExpensesCurrentMonth - ctx.antExpensesPreviousMonth) / ctx.antExpensesPreviousMonth;

    if (variation > 0.1) {
      alerts.push({
        alertType: AlertType.ANT_EXPENSE_INCREASE,
        title: 'Tus gastos hormiga aumentaron',
        message: `Tus gastos hormiga subieron un ${(variation * 100).toFixed(0)}% respecto al mes anterior. Revisarlos puede transformarse en ahorro visible.`,
        context: { current: ctx.antExpensesCurrentMonth, previous: ctx.antExpensesPreviousMonth, variation, period: ctx.period },
        priority: 'medium',
      });
    } else if (variation < -0.1) {
      alerts.push({
        alertType: AlertType.ANT_EXPENSE_DECREASE,
        title: '¡Tus gastos hormiga mejoraron!',
        message: `Tus gastos hormiga bajaron un ${(Math.abs(variation) * 100).toFixed(0)}% este mes. Mantener este hábito puede transformarse en más capacidad de ahorro.`,
        context: { current: ctx.antExpensesCurrentMonth, previous: ctx.antExpensesPreviousMonth, variation, period: ctx.period },
        priority: 'low',
      });
    }
  }

  private checkBudgetOverrun(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    if (!ctx.budgetOverrunCategories.length) return;
    alerts.push({
      alertType: AlertType.BUDGET_OVERRUN,
      title: 'Superaste el presupuesto en algunas categorías',
      message: `Este mes superaste tu presupuesto en: ${ctx.budgetOverrunCategories.join(', ')}. Revisa qué consumos explican la desviación.`,
      context: { categories: ctx.budgetOverrunCategories, period: ctx.period },
      priority: 'high',
    });
  }

  private checkCreditPressure(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    if (!ctx.totalExpensesWithoutCredit) return;
    const improvementPct = (ctx.totalExpenses - ctx.totalExpensesWithoutCredit) / ctx.totalExpenses;
    if (improvementPct > 0.2) {
      alerts.push({
        alertType: AlertType.CREDIT_PRESSURE,
        title: 'Tus créditos están presionando tu flujo',
        message: `Sin considerar créditos, tu situación mejora un ${(improvementPct * 100).toFixed(0)}%. El endeudamiento está absorbiendo una parte importante de tu liquidez mensual.`,
        context: { withCredit: ctx.totalExpenses, withoutCredit: ctx.totalExpensesWithoutCredit, improvementPct, period: ctx.period },
        priority: 'high',
      });
    }
  }

  private checkRecurringCharges(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    for (const charge of ctx.recurringChargesDetected) {
      alerts.push({
        alertType: AlertType.RECURRING_CHARGE_DETECTED,
        title: 'Cargo recurrente detectado',
        message: `Detectamos un cargo recurrente estable en tu estructura mensual: "${charge}". Conviene validarlo y considerarlo en tu presupuesto base.`,
        context: { charge, period: ctx.period },
        priority: 'low',
      });
    }
  }

  private checkUncategorized(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    if (!ctx.uncategorizedCount) return;
    alerts.push({
      alertType: AlertType.UNCATEGORIZED_MOVEMENTS,
      title: 'Tienes movimientos sin categorizar',
      message: `Hay ${ctx.uncategorizedCount} movimiento${ctx.uncategorizedCount > 1 ? 's' : ''} sin clasificar. Revisarlos mejorará la calidad de tu análisis.`,
      context: { count: ctx.uncategorizedCount, period: ctx.period },
      priority: 'medium',
    });
  }

  private checkBillsDue(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    if (ctx.billsDueSoon.length > 0) {
      alerts.push({
        alertType: AlertType.BILL_DUE_SOON,
        title: 'Tienes cuentas próximas a vencer',
        message: `Las siguientes cuentas vencen pronto: ${ctx.billsDueSoon.map(b => b.title).join(', ')}.`,
        context: { bills: ctx.billsDueSoon },
        priority: 'high',
      });
    }
    if (ctx.billsOverdue.length > 0) {
      alerts.push({
        alertType: AlertType.BILL_OVERDUE,
        title: 'Tienes cuentas vencidas',
        message: `Las siguientes cuentas están vencidas: ${ctx.billsOverdue.map(b => b.title).join(', ')}. Regularízalas lo antes posible.`,
        context: { bills: ctx.billsOverdue },
        priority: 'high',
      });
    }
  }

  private checkRecoverableSavings(ctx: AlertContext, alerts: TriggeredAlert[]): void {
    if (!ctx.totalIncome) return;
    const antPct = ctx.antExpensesCurrentMonth / ctx.totalIncome;
    if (antPct > 0.05) {
      alerts.push({
        alertType: AlertType.RECOVERABLE_SAVINGS,
        title: 'Tienes ahorro potencial recuperable',
        message: `Tus gastos hormiga representan el ${(antPct * 100).toFixed(1)}% de tu ingreso. Parte de ese gasto podría transformarse en ahorro.`,
        context: { antExpenses: ctx.antExpensesCurrentMonth, income: ctx.totalIncome, antPct, period: ctx.period },
        priority: 'medium',
      });
    }
  }
}
