import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { RedisModule } from '../../redis/redis.module';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';

@Module({
  imports: [RedisModule, GatewayModule],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
