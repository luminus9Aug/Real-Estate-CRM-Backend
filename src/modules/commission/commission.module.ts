import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { RedisModule } from '../../redis/redis.module';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';

import { CommissionTransactionRepository } from './commission-transaction.repository';

@Module({
  imports: [RedisModule, GatewayModule],
  controllers: [CommissionController],
  providers: [CommissionService, CommissionTransactionRepository],
  exports: [CommissionService, CommissionTransactionRepository],
})
export class CommissionModule {}
