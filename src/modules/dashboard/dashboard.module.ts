import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [RedisModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
