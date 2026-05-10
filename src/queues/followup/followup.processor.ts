import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FOLLOWUP_QUEUE } from './followup.producer';

export interface FollowupJobPayload {
  tenantId: string;
  followUpId: string;
}

@Processor(FOLLOWUP_QUEUE)
export class FollowupProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowupProcessor.name);

  async process(job: Job<FollowupJobPayload>): Promise<void> {
    this.logger.log(`Follow-up job ${job.id} for tenant ${job.data.tenantId}`);
  }
}
