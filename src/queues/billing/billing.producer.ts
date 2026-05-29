import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { RazorpayWebhookPayload } from '../../modules/billing/types/razorpay.types';

@Injectable()
export class BillingProducer {
  constructor(@InjectQueue('billing') private readonly billingQueue: Queue) {}

  async addWebhookJob(eventId: string, payload: RazorpayWebhookPayload) {
    await this.billingQueue.add(
      'process-webhook',
      { eventId, payload },
      {
        jobId: eventId, // Use eventId as jobId for BullMQ-level deduplication
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }
}
