import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

import { SubscriptionModule } from '../subscription/subscription.module';

import { LeadRepository } from '../lead/lead.repository';
import { CommissionTransactionRepository } from '../commission/commission-transaction.repository';

@Module({
  imports: [SubscriptionModule],
  controllers: [ReportController],
  providers: [ReportService, LeadRepository, CommissionTransactionRepository],
})
export class ReportModule {}
