import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 60000,
          limit: 100,
        },
      ],
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
          ],
          // MVP: en producción usa migraciones; si aún no existen, DB_SYNC=true crea esquema (solo transitorio).
          synchronize: !isProd || forceSync,
          logging: config.get<string>('NODE_ENV') === 'development',
        };
      },
    }),
    UsersModule,
    AuthModule,
    CashflowModule,
  ],
})
export class AppModule {}
