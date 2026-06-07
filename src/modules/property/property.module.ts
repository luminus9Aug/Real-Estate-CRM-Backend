import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UserModule } from '../user/user.module';

import { PropertyRepository } from './property.repository';
import { BrochureLinkRepository } from './brochure-link.repository';

@Module({
  imports: [RedisModule, SubscriptionModule, UserModule],
  controllers: [PropertyController],
  providers: [PropertyService, PropertyRepository, BrochureLinkRepository],
  exports: [PropertyService, PropertyRepository],
})
export class PropertyModule {}
