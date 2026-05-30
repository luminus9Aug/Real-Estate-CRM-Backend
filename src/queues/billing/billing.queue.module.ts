import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingProducer } from './billing.producer';
import { BillingProcessor } from './billing.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'billing',
    }),
  ],
  providers: [BillingProducer, BillingProcessor],
  exports: [BillingProducer],
})
export class BillingQueueModule {}
