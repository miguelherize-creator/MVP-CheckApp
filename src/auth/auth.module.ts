import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { BiometricPreferences } from './entities/biometric-preferences.entity';
import { OnboardingState } from './entities/onboarding-state.entity';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { CashflowModule } from '../cashflow/cashflow.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UserGamificationStats } from '../gamification/entities/user-gamification-stats.entity';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    CashflowModule,
    MailModule,
    CatalogModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      RefreshToken,
      PasswordResetToken,
      EmailVerificationToken,
      BiometricPreferences,
      OnboardingState,
      UserGamificationStats,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
