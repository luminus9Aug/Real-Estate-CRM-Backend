import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { WhatsappJobPayload } from './whatsapp-job.interface';

export const WHATSAPP_QUEUE = 'whatsapp';

@Injectable()
export class WhatsappProducer {
  constructor(@InjectQueue(WHATSAPP_QUEUE) private readonly queue: Queue) {}

  async enqueue(payload: WhatsappJobPayload): Promise<void> {
    await this.queue.add('send', payload, { removeOnComplete: true });
  }
}
