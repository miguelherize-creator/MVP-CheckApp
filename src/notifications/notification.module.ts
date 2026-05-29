import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertPreferences } from './entities/alert-preferences.entity';
import { NotificationQueue } from './entities/notification-queue.entity';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';
import { AlertRulesEngine } from './services/alert-rules.engine';

@Module({
  imports: [TypeOrmModule.forFeature([AlertPreferences, NotificationQueue])],
  controllers: [NotificationController],
  providers: [NotificationService, AlertRulesEngine],
  exports: [NotificationService, AlertRulesEngine],
})
export class NotificationModule {}
