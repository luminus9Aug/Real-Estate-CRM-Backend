import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { RedisModule } from '../../redis/redis.module';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';

import { SubscriptionModule } from '../subscription/subscription.module';

import { LeadRepository } from './lead.repository';
import { UserRepository } from '../user/user.repository';
import { PropertyRepository } from '../property/property.repository';
import { CommissionTransactionRepository } from '../commission/commission-transaction.repository';
import { ActivityRepository } from '../dashboard/activity.repository';
import { FollowUpRepository } from '../followup/followup.repository';

@Module({
  imports: [RedisModule, GatewayModule, SubscriptionModule],
  controllers: [LeadController],
  providers: [
    LeadService,
    LeadRepository,
    UserRepository,
    PropertyRepository,
    CommissionTransactionRepository,
    ActivityRepository,
    FollowUpRepository,
  ],
  exports: [LeadService, LeadRepository],
})
export class LeadModule {}
