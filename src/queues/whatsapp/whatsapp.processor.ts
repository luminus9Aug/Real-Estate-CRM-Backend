import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { WhatsappJobPayload } from './whatsapp-job.interface';
import { WHATSAPP_QUEUE } from './whatsapp.producer';

@Processor(WHATSAPP_QUEUE)
export class WhatsappProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappProcessor.name);

  async process(job: Job<WhatsappJobPayload>): Promise<void> {
    this.logger.log(`WhatsApp job ${job.id} queued for lead ${job.data.leadId} (async send)`);
    // Phase 1: integrate Twilio REST in worker; do not block HTTP.
  }
}
