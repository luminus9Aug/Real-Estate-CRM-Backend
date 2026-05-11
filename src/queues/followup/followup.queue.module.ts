import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FOLLOWUP_QUEUE, FollowupProducer } from './followup.producer';
import { FollowupProcessor } from './followup.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: FOLLOWUP_QUEUE,
    }),
    PrismaModule,
    GatewayModule,
  ],
  providers: [FollowupProducer, FollowupProcessor],
  exports: [FollowupProducer],
})
export class FollowupQueueModule {}
