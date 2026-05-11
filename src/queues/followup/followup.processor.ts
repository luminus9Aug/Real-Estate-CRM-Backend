import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FOLLOWUP_QUEUE } from './followup.producer';

import { MessageGateway } from '../../gateways/message.gateway';
import { PrismaService } from '../../prisma/prisma.service';

export interface FollowupJobPayload {
  tenantId: string;
  followUpId: string;
}

@Processor(FOLLOWUP_QUEUE)
export class FollowupProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessageGateway,
  ) {
    super();
  }

  async process(job: Job<FollowupJobPayload>): Promise<void> {
    const { tenantId, followUpId } = job.data;
    this.logger.log(`Processing follow-up job ${job.id} for tenant ${tenantId}`);

    const followUp = await this.prisma.followUp.findUnique({
      where: { id: followUpId },
      include: { lead: { select: { name: true } } },
    });

    if (!followUp || followUp.completedAt) {
      this.logger.debug(`Follow-up ${followUpId} not found or already completed.`);
      return;
    }

    this.gateway.emitFollowUpDue(tenantId, {
      followUpId: followUp.id,
      leadId: followUp.leadId,
      leadName: followUp.lead.name,
      message: followUp.message,
      dueAt: followUp.dueAt,
    });
  }
}
