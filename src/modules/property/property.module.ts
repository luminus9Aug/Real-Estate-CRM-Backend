import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';

import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [RedisModule, SubscriptionModule],
  controllers: [PropertyController],
  providers: [PropertyService],
})
export class PropertyModule {}
