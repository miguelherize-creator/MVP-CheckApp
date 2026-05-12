import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { Currency } from './entities/currency.entity';
import { DocumentType } from './entities/document-type.entity';
import { StatusDomain } from './entities/status-domain.entity';
import { Status } from './entities/status.entity';
import { Role } from './entities/role.entity';

export interface CatalogDefaults {
  countryId: number;
  currencyId: number;
  roleId: number;
  activeStatusId: number;
  pendingVerificationStatusId: number;
  suspendedStatusId: number;
  rutDocumentTypeId: number;
  rutDocumentTypeCode: string;
  rutValidationRegex: string;
}

@Injectable()
export class CatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeedService.name);
  private defaults: CatalogDefaults | null = null;

  constructor(
    @InjectRepository(Country) private readonly countryRepo: Repository<Country>,
    @InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
    @InjectRepository(DocumentType) private readonly documentTypeRepo: Repository<DocumentType>,
    @InjectRepository(StatusDomain) private readonly statusDomainRepo: Repository<StatusDomain>,
    @InjectRepository(Status) private readonly statusRepo: Repository<Status>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed(): Promise<void> {
    this.logger.log('Seeding catalog tables...');

    const RUT_REGEX = '^\\d{7,8}-[\\dkK]$';
    const country = await this.upsertCountry('CL', 'Chile');
    const currency = await this.upsertCurrency('CLP', 'Peso chileno', 0);
    const rutDocumentType = await this.upsertDocumentType('RUT', 'RUT chileno', country.countryId, RUT_REGEX);
    const userDomain = await this.upsertStatusDomain('user', 'Usuario');
    const pendingVerificationStatus = await this.upsertStatus(userDomain.statusDomainId, 'pending_verification', 'Pendiente de verificación');
    const activeStatus = await this.upsertStatus(userDomain.statusDomainId, 'active', 'Activo');
    await this.upsertStatus(userDomain.statusDomainId, 'inactive', 'Inactivo');
    const suspendedStatus = await this.upsertStatus(userDomain.statusDomainId, 'suspended', 'Suspendido');
    await this.upsertStatus(userDomain.statusDomainId, 'deleted', 'Eliminado');

    const paymentMethodDomain = await this.upsertStatusDomain('payment_method', 'Método de pago');
    await this.upsertStatus(paymentMethodDomain.statusDomainId, 'active', 'Activo');
    await this.upsertStatus(paymentMethodDomain.statusDomainId, 'expired', 'Expirado');
    await this.upsertStatus(paymentMethodDomain.statusDomainId, 'revoked', 'Revocado');

    const subscriptionDomain = await this.upsertStatusDomain('subscription', 'Suscripción');
    await this.upsertStatus(subscriptionDomain.statusDomainId, 'active', 'Activo');
    await this.upsertStatus(subscriptionDomain.statusDomainId, 'cancelled', 'Cancelado');
    await this.upsertStatus(subscriptionDomain.statusDomainId, 'expired', 'Expirado');
    await this.upsertStatus(subscriptionDomain.statusDomainId, 'paused', 'Pausado');

    const userRole = await this.upsertRole('user', 'Usuario');
    await this.upsertRole('admin', 'Administrador');

    this.defaults = {
      countryId: Number(country.countryId),
      currencyId: Number(currency.currencyId),
      roleId: Number(userRole.roleId),
      activeStatusId: Number(activeStatus.statusId),
      pendingVerificationStatusId: Number(pendingVerificationStatus.statusId),
      suspendedStatusId: Number(suspendedStatus.statusId),
      rutDocumentTypeId: Number(rutDocumentType.documentTypeId),
      rutDocumentTypeCode: rutDocumentType.code,
      rutValidationRegex: RUT_REGEX,
    };

    this.logger.log('Catalog seed complete');
  }

  getDefaults(): CatalogDefaults {
    if (!this.defaults) {
      throw new Error('CatalogSeedService not initialized — call seed() first');
    }
    return this.defaults;
  }

  private async upsertCountry(code: string, name: string): Promise<Country> {
    let entity = await this.countryRepo.findOne({ where: { countryCode: code } });
    if (!entity) {
      entity = await this.countryRepo.save(this.countryRepo.create({ countryCode: code, name }));
    }
    return entity;
  }

  private async upsertCurrency(code: string, name: string, minorUnits: number): Promise<Currency> {
    let entity = await this.currencyRepo.findOne({ where: { currencyCode: code } });
    if (!entity) {
      entity = await this.currencyRepo.save(this.currencyRepo.create({ currencyCode: code, name, minorUnits }));
    }
    return entity;
  }

  private async upsertDocumentType(
    code: string,
    name: string,
    countryId: number,
    validationRegex: string | null = null,
  ): Promise<DocumentType> {
    let entity = await this.documentTypeRepo.findOne({ where: { code } });
    if (!entity) {
      entity = await this.documentTypeRepo.save(
        this.documentTypeRepo.create({ code, name, countryId, subjectScope: 'person', validationRegex }),
      );
    } else if (entity.validationRegex !== validationRegex) {
      entity.validationRegex = validationRegex;
      entity = await this.documentTypeRepo.save(entity);
    }
    return entity;
  }

  private async upsertStatusDomain(code: string, name: string): Promise<StatusDomain> {
    let entity = await this.statusDomainRepo.findOne({ where: { code } });
    if (!entity) {
      entity = await this.statusDomainRepo.save(this.statusDomainRepo.create({ code, name }));
    }
    return entity;
  }

  private async upsertStatus(domainId: number, code: string, name: string): Promise<Status> {
    let entity = await this.statusRepo.findOne({ where: { statusDomainId: domainId, code } });
    if (!entity) {
      entity = await this.statusRepo.save(
        this.statusRepo.create({ statusDomainId: domainId, code, name }),
      );
    }
    return entity;
  }

  private async upsertRole(code: string, name: string): Promise<Role> {
    let entity = await this.roleRepo.findOne({ where: { code } });
    if (!entity) {
      entity = await this.roleRepo.save(this.roleRepo.create({ code, name, description: null }));
    }
    return entity;
  }
}
