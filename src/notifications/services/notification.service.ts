import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertPreferences } from '../entities/alert-preferences.entity';
import { NotificationQueue } from '../entities/notification-queue.entity';
import { AlertRulesEngine, AlertContext, AlertType, ALERT_CATALOG } from './alert-rules.engine';

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface AlertSectionItem {
  alertType: string;
  label: string;
  description: string;
  enabled: boolean;
  cadenceDays: number;
  preferenceId: string | null;
}

export interface AlertSection {
  key: string;
  title: string;
  items: AlertSectionItem[];
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(AlertPreferences)
    private readonly prefRepo: Repository<AlertPreferences>,
    @InjectRepository(NotificationQueue)
    private readonly queueRepo: Repository<NotificationQueue>,
    private readonly rulesEngine: AlertRulesEngine,
  ) {}

  // ─── Pantalla "Mis Avisos" — preferencias agrupadas por sección ───────────

  /**
   * Devuelve las preferencias del usuario organizadas en las secciones
   * que muestra la pantalla "Mis Avisos":
   *   - Mis pagos
   *   - Mi presupuesto
   *   - Mensajes
   *
   * Si el usuario no tiene una preferencia guardada para un tipo,
   * usa los valores por defecto del catálogo.
   */
  async getPreferencesBySections(userId: string): Promise<AlertSection[]> {
    const saved = await this.prefRepo.find({ where: { userId } });
    const savedMap = new Map(saved.map(p => [`${p.alertType}-${p.channel}`, p] as const));
    const sectionMap: Record<string, { title: string; items: AlertSectionItem[] }> = {
      mis_pagos:      { title: 'Mis pagos',      items: [] },
      mi_presupuesto: { title: 'Mi presupuesto', items: [] },
      mensajes:       { title: 'Mensajes',        items: [] },
    };

    for (const catalogItem of ALERT_CATALOG) {
      const key = `${catalogItem.alertType}-in_app`;
      const savedPref = saved.find(p => p.alertType === catalogItem.alertType && p.channel === 'in_app');

      sectionMap[catalogItem.section].items.push({
        alertType:    catalogItem.alertType,
        label:        catalogItem.label,
        description:  catalogItem.description,
        enabled:      savedPref ? savedPref.enabled : catalogItem.defaultEnabled,
        cadenceDays:  savedPref?.cadenceDays ?? catalogItem.defaultCadenceDays,
        preferenceId: savedPref?.id ?? null,
      });
    }

    return Object.entries(sectionMap).map(([key, section]) => ({
      key,
      title: section.title,
      items: section.items,
    }));
  }

  // ─── Toggle de una preferencia desde el switch de la pantalla ─────────────

  /**
   * Activa o desactiva una alerta específica (el toggle de la pantalla).
   * Si no existe la preferencia la crea con los valores por defecto.
   */
  async togglePreference(userId: string, alertType: string, enabled: boolean): Promise<AlertPreferences> {
    let pref = await this.prefRepo.findOne({ where: { userId, alertType, channel: 'in_app' } });

    if (!pref) {
      const catalogItem = ALERT_CATALOG.find(c => c.alertType === alertType);
      pref = this.prefRepo.create({
        userId,
        alertType,
        channel: 'in_app',
        enabled,
        cadenceDays: catalogItem?.defaultCadenceDays ?? 7,
        intensity: null,
      });
    } else {
      pref.enabled = enabled;
    }

    return this.prefRepo.save(pref);
  }

  // ─── Upsert genérico (para casos avanzados) ───────────────────────────────

  async upsertPreference(userId: string, dto: {
    alertType: string; channel: string; enabled?: boolean; intensity?: string; cadenceDays?: number;
  }): Promise<AlertPreferences> {
    let pref = await this.prefRepo.findOne({ where: { userId, alertType: dto.alertType, channel: dto.channel } });
    if (!pref) pref = this.prefRepo.create({ userId, alertType: dto.alertType, channel: dto.channel });
    if (dto.enabled !== undefined) pref.enabled = dto.enabled;
    if (dto.intensity !== undefined) pref.intensity = dto.intensity;
    if (dto.cadenceDays !== undefined) pref.cadenceDays = dto.cadenceDays;
    return this.prefRepo.save(pref);
  }

  // ─── Crear preferencias por defecto (onboarding) ─────────────────────────

  async createDefaultPreferences(userId: string): Promise<void> {
    const existing = await this.prefRepo.find({ where: { userId } });
    const existingKeys = new Set(existing.map(p => `${p.alertType}-${p.channel}`));

    const toCreate = ALERT_CATALOG
      .filter(item => !existingKeys.has(`${item.alertType}-in_app`))
      .map(item => this.prefRepo.create({
        userId,
        alertType: item.alertType,
        channel: 'in_app',
        enabled: item.defaultEnabled,
        cadenceDays: item.defaultCadenceDays,
        intensity: null,
      }));

    if (toCreate.length > 0) await this.prefRepo.save(toCreate);
    this.logger.log(`Preferencias por defecto creadas para usuario ${userId}`);
  }

  // ─── Evaluación y encolado de alertas ────────────────────────────────────

  async evaluateAndEnqueue(userId: string, ctx: AlertContext): Promise<NotificationQueue[]> {
    const triggered = this.rulesEngine.evaluate(ctx);
    if (!triggered.length) return [];

    const preferences = await this.prefRepo.find({ where: { userId, enabled: true } });
    const queued: NotificationQueue[] = [];

    for (const alert of triggered) {
      const pref = preferences.find(p => p.alertType === alert.alertType && p.channel === 'in_app');

      // Si tiene la alerta desactivada la saltamos
      if (preferences.some(p => p.alertType === alert.alertType) && !pref) continue;

      const cadenceDays = pref?.cadenceDays ?? 1;
      if (await this.wasRecentlySent(userId, alert.alertType, 'in_app', cadenceDays)) continue;

        const notification = this.queueRepo.create({
          userId,
          channel: 'in_app',
          payload: {
            alertType: alert.alertType,
            title: alert.title,
            message: alert.message,
            context: alert.context,
          } as any,
          scheduledFor: new Date(),
          sentAt: null,
          referenceType: null,
          referenceId: null,
        });
      queued.push(await this.queueRepo.save(notification));
    }

    this.logger.log(`Usuario ${userId}: ${triggered.length} evaluadas, ${queued.length} encoladas`);
    return queued;
  }

  // ─── Cola in-app ──────────────────────────────────────────────────────────

  async getPendingInApp(userId: string): Promise<NotificationQueue[]> {
    return this.queueRepo.find({
      where: { userId, channel: 'in_app', sentAt: null as any },
      order: { scheduledFor: 'DESC' },
    });
  }

  async markAsSent(notificationId: string, userId: string): Promise<NotificationQueue> {
    const n = await this.queueRepo.findOne({ where: { id: notificationId, userId } });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    n.sentAt = new Date();
    return this.queueRepo.save(n);
  }

  async getHistory(userId: string): Promise<NotificationQueue[]> {
    return this.queueRepo.find({ where: { userId }, order: { scheduledFor: 'DESC' }, take: 50 });
  }

  // ─── Helper: cadencia ─────────────────────────────────────────────────────

  private async wasRecentlySent(userId: string, alertType: string, channel: string, cadenceDays: number): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - cadenceDays);
    const recent = await this.queueRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere("n.payload->>'alertType' = :alertType", { alertType })
      .andWhere('n.channel = :channel', { channel })
      .andWhere('n.sent_at > :since', { since })
      .getOne();
    return !!recent;
  }
}
