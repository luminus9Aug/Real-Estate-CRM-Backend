import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { ContactJobPayload } from './contact-job.interface';

export const CONTACT_QUEUE = 'contact';

@Injectable()
export class ContactProducer {
  constructor(@InjectQueue(CONTACT_QUEUE) private readonly queue: Queue) {}

  async enqueue(payload: ContactJobPayload): Promise<void> {
    await this.queue.add('send_contact_email', payload, {
      removeOnComplete: true,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
