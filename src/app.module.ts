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
import { EmailVerificationToken } from './auth/entities/email-verification-token.entity';
import { BiometricPreferences } from './auth/entities/biometric-preferences.entity';
import { OnboardingState } from './auth/entities/onboarding-state.entity';
import { CashflowModule } from './cashflow/cashflow.module';
import { FundingSource } from './cashflow/entities/funding-source.entity';
import { Category } from './cashflow/entities/category.entity';
import { Subcategory } from './cashflow/entities/subcategory.entity';
import { Transaction } from './cashflow/entities/transaction.entity';
import { AntExpenseRule } from './cashflow/entities/ant-expense-rule.entity';
import { UserFinancialProfile } from './profile/entities/user-financial-profile.entity';
import { UserGoal } from './profile/entities/user-goal.entity';
import { AlertPreferences } from './notifications/entities/alert-preferences.entity';
import { NotificationQueue } from './notifications/entities/notification-queue.entity';
import { BudgetPeriod } from './budget/entities/budget-period.entity';
import { BudgetLine } from './budget/entities/budget-line.entity';
import { Debt } from './debts/entities/debt.entity';
import { DebtSchedule } from './debts/entities/debt-schedule.entity';
import { DebtPayment } from './debts/entities/debt-payment.entity';
import { DebtAttachment } from './debts/entities/debt-attachment.entity';
import { DebtSnowballPlan } from './debts/entities/debt-snowball-plan.entity';
import { StatementImport } from './imports/entities/statement-import.entity';
import { ImportLineItem } from './imports/entities/import-line-item.entity';
import { MovementClassificationSuggestion } from './imports/entities/movement-classification-suggestion.entity';
import { BillPayable } from './payments/entities/bill-payable.entity';
import { RecurringPaymentSuggestion } from './payments/entities/recurring-payment-suggestion.entity';
import { GamificationRule } from './gamification/entities/gamification-rule.entity';
import { GamificationEvent } from './gamification/entities/gamification-event.entity';
import { UserGamificationStats } from './gamification/entities/user-gamification-stats.entity';
import { UserScoreHistory } from './gamification/entities/user-score-history.entity';
import { FinancialHealthSnapshot } from './health/entities/financial-health-snapshot.entity';
import { RecommendationEvent } from './health/entities/recommendation-event.entity';
import { AiConversation } from './ai/entities/ai-conversation.entity';
import { AiMessage } from './ai/entities/ai-message.entity';
import { AiToolInvocation } from './ai/entities/ai-tool-invocation.entity';
import { AiContextSnapshot } from './ai/entities/ai-context-snapshot.entity';
import { FaqArticle } from './ai/entities/faq-article.entity';
import { AdminUser } from './admin/entities/admin-user.entity';
import { AppConfig } from './admin/entities/app-config.entity';
import { AdminAuditLog } from './admin/entities/admin-audit-log.entity';
import { AuditLog } from './admin/entities/audit-log.entity';
import { ReportSnapshot } from './admin/entities/report-snapshot.entity';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SubscriptionPlan } from './subscriptions/entities/subscription-plan.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { PaymentOrder } from './subscriptions/entities/payment-order.entity';
// ── Módulos nuevos ────────────────────────────────────────────────────────────
import { ProfileModule } from './profile/profile.module';
import { StatementImportModule } from './imports/statement-import.module';
import { NotificationModule } from './notifications/notification.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'short', ttl: 60000, limit: 100 }],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbSync = config.get<string>('DB_SYNC', 'false') === 'true';
        return {
          type: 'postgres',
          url: config.getOrThrow<string>('DATABASE_URL'),
          entities: [
            User, RefreshToken, PasswordResetToken,
            EmailVerificationToken, BiometricPreferences, OnboardingState,
            FundingSource, Category, Subcategory, Transaction, AntExpenseRule,
            UserFinancialProfile, UserGoal,
            AlertPreferences, NotificationQueue,
            BudgetPeriod, BudgetLine,
            Debt, DebtSchedule, DebtPayment, DebtAttachment, DebtSnowballPlan,
            StatementImport, ImportLineItem, MovementClassificationSuggestion,
            BillPayable, RecurringPaymentSuggestion,
            GamificationRule, GamificationEvent, UserGamificationStats, UserScoreHistory,
            FinancialHealthSnapshot, RecommendationEvent,
            AiConversation, AiMessage, AiToolInvocation, AiContextSnapshot, FaqArticle,
            AdminUser, AppConfig, AdminAuditLog, AuditLog, ReportSnapshot,
            SubscriptionPlan, Subscription, PaymentOrder,
          ],
          synchronize: dbSync,
          logging: config.get<string>('NODE_ENV') === 'development',
        };
      },
    }),
    UsersModule,
    AuthModule,
    CashflowModule,
    SubscriptionsModule,
    // Módulos nuevos
    ProfileModule,
    StatementImportModule,
    NotificationModule,
  ],
})
export class AppModule {}
