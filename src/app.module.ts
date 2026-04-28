import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
import { CashflowModule } from './cashflow/cashflow.module';
import { FundingSource } from './cashflow/entities/funding-source.entity';
import { Category } from './cashflow/entities/category.entity';
import { Subcategory } from './cashflow/entities/subcategory.entity';
import { Transaction } from './cashflow/entities/transaction.entity';
// ── M2: Perfil financiero ─────────────────────────────────────────────────────
import { ProfileModule } from './profile/profile.module';
import { UserFinancialProfile } from './profile/entities/user-financial-profile.entity';
// ── M5: Importación de cartolas ───────────────────────────────────────────────
import { StatementImportModule } from './statement-import/statement-import.module';
import { StatementImport } from './statement-import/entities/statement-import.entity';
import { ImportLineItem } from './statement-import/entities/import-line-item.entity';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'short', ttl: 60000, limit: 100 }],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV', 'development') === 'production';
        const forceSync = config.get<string>('DB_SYNC', 'false') === 'true';
        return {
          type: 'postgres',
          url: config.getOrThrow<string>('DATABASE_URL'),
          entities: [
            User,
            RefreshToken,
            PasswordResetToken,
            FundingSource,
            Category,
            Subcategory,
            Transaction,
            // M2
            UserFinancialProfile,
            // M5
            StatementImport,
            ImportLineItem,
          ],
          synchronize: !isProd || forceSync,
          logging: config.get<string>('NODE_ENV') === 'development',
        };
      },
    }),
    UsersModule,
    AuthModule,
    CashflowModule,
    ProfileModule,
    StatementImportModule,
  ],
})
export class AppModule {}
