import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { BillingService } from '../../modules/billing/billing.service';

import { RazorpayWebhookPayload } from '../../modules/billing/types/razorpay.types';

@Processor('billing')
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(private readonly billingService: BillingService) {
    super();
  }

  async process(job: Job<{ eventId: string; payload: RazorpayWebhookPayload }, unknown, string>): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} (${job.name})`);

    switch (job.name) {
      case 'process-webhook':
        return this.billingService.executeWebhookLogic(job.data.eventId, job.data.payload);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
