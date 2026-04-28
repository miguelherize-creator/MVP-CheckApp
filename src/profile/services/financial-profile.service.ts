import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFinancialProfile } from '../entities/user-financial-profile.entity';
import { UpsertFinancialProfileDto } from '../dto/upsert-financial-profile.dto';

@Injectable()
export class FinancialProfileService {
  constructor(
    @InjectRepository(UserFinancialProfile)
    private readonly profileRepo: Repository<UserFinancialProfile>,
  ) {}

  /**
   * Devuelve el perfil financiero del usuario.
   * Si aún no existe, retorna null (el frontend lo usa para saber
   * si el usuario completó el onboarding financiero).
   */
  async findByUserId(userId: string): Promise<UserFinancialProfile | null> {
    return this.profileRepo.findOne({ where: { userId } });
  }

  /**
   * Crea o actualiza el perfil financiero del usuario (upsert).
   * Solo actualiza los campos enviados; los omitidos no se tocan.
   */
  async upsert(
    userId: string,
    dto: UpsertFinancialProfileDto,
  ): Promise<UserFinancialProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profileRepo.create({ userId });
    }

    if (dto.monthlyIncomeEstimate !== undefined) {
      profile.monthlyIncomeEstimate = dto.monthlyIncomeEstimate;
    }
    if (dto.stableExpensesNote !== undefined) {
      profile.stableExpensesNote = dto.stableExpensesNote;
    }
    if (dto.estimatedPaymentCapacity !== undefined) {
      profile.estimatedPaymentCapacity = dto.estimatedPaymentCapacity;
    }
    if (dto.currency !== undefined) {
      profile.currency = dto.currency.toUpperCase();
    }

    return this.profileRepo.save(profile);
  }
}
