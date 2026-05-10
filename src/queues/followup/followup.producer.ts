import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const FOLLOWUP_QUEUE = 'followup';

@Injectable()
export class FollowupProducer {
  constructor(@InjectQueue(FOLLOWUP_QUEUE) private readonly queue: Queue) {}

  async scheduleCheck(tenantId: string, followUpId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      'due',
      { tenantId, followUpId },
      { delay: delayMs, removeOnComplete: true },
    );
  }
}
