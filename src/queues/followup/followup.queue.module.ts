import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FOLLOWUP_QUEUE, FollowupProducer } from './followup.producer';
import { FollowupProcessor } from './followup.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: FOLLOWUP_QUEUE,
    }),
  ],
  providers: [FollowupProducer, FollowupProcessor],
  exports: [FollowupProducer],
})
export class FollowupQueueModule {}
