import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFinancialProfile } from './entities/user-financial-profile.entity';
import { FinancialProfileService } from './services/financial-profile.service';
import { FinancialProfileController } from './controllers/financial-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserFinancialProfile])],
  controllers: [FinancialProfileController],
  providers: [FinancialProfileService],
  exports: [FinancialProfileService],
})
export class ProfileModule {}
