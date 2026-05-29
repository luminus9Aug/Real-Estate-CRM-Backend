import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingProducer } from '../../queues/billing/billing.producer';
import { BillingProcessor } from '../../queues/billing/billing.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'billing',
    }),
  ],
  providers: [BillingService, BillingProducer, BillingProcessor],
  controllers: [BillingController],
  exports: [BillingService, BillingProducer],
})
export class BillingModule {}
