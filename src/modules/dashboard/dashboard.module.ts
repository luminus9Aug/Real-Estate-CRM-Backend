import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { LeadRepository } from '../lead/lead.repository';
import { PropertyRepository } from '../property/property.repository';
import { CommissionTransactionRepository } from '../commission/commission-transaction.repository';
import { FollowUpRepository } from '../followup/followup.repository';
import { UserRepository } from '../user/user.repository';
import { ActivityRepository } from './activity.repository';

@Module({
  imports: [RedisModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    LeadRepository,
    PropertyRepository,
    CommissionTransactionRepository,
    FollowUpRepository,
    UserRepository,
    ActivityRepository,
  ],
})
export class DashboardModule {}
