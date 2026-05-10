import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';

@Module({
  imports: [RedisModule],
  controllers: [PropertyController],
  providers: [PropertyService],
})
export class PropertyModule {}
