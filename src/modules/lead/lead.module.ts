import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { RedisModule } from '../../redis/redis.module';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';

import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [RedisModule, GatewayModule, SubscriptionModule],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
