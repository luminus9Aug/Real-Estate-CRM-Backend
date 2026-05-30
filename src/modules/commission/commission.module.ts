import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { RedisModule } from '../../redis/redis.module';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';

@Module({
  imports: [RedisModule, GatewayModule],
  controllers: [CommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
